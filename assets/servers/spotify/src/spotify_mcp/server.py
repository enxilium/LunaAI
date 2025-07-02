import asyncio
import base64
import os
import logging
import sys
from enum import Enum
import json
from typing import List, Optional, Tuple
from datetime import datetime
from pathlib import Path

import mcp.types as types
from mcp.server import NotificationOptions, Server  # , stdio_server
import mcp.server.stdio
from pydantic import BaseModel, Field
from spotipy import SpotifyException

from . import spotify_api, utils


def setup_logger():
    class Logger:
        def info(self, message):
            print(f"[INFO] {message}", file=sys.stderr)

        def error(self, message):
            print(f"[ERROR] {message}", file=sys.stderr)

    return Logger()


logger = setup_logger()
server = Server(
    "spotify-mcp",
    "1.3.0",
    "A server for interfacing with the Spotify API.",
)
spotify_client = spotify_api.Client(logger)

# Normalize the redirect URI to meet Spotify's requirements
if spotify_api.REDIRECT_URI:
    spotify_api.REDIRECT_URI = utils.normalize_redirect_uri(spotify_api.REDIRECT_URI)


class ToolModel(BaseModel):
    model_config = {"use_enum_values": True, "json_schema_mode": "validation"}

    @classmethod
    def as_tool(cls):
        # Generate the schema from the Pydantic model
        schema = cls.model_json_schema()

        # Pydantic v2 represents Optional[T] as an `anyOf` with `type: null`.
        # The Gemini API rejects this, preferring `nullable: true`.
        # We'll manually patch the schema to be compliant.
        if "properties" in schema:
            for prop, details in schema["properties"].items():
                if "anyOf" in details and len(details["anyOf"]) == 2:
                    # Find the non-null type definition in the 'anyOf' array
                    non_null_schema = next(
                        (s for s in details["anyOf"] if s.get("type") != "null"), None
                    )

                    # If we found it, replace the 'anyOf' with the simpler, nullable format
                    if non_null_schema:
                        details.clear()
                        details.update(non_null_schema)
                        details["nullable"] = True

        return types.Tool(
            name="Spotify" + cls.__name__,
            description=cls.__doc__,
            inputSchema=schema,
        )


class Playback(ToolModel):
    """Manages the current playback with the following actions:
    - get: Get information about user's current track.
    - start: Starts playing new item or resumes current playback if called with no uri.
    - pause: Pauses current playback.
    - skip: Skips current track.
    """
    action: str = Field(description="Action to perform: 'get', 'start', 'pause' or 'skip'.")
    spotify_uri: Optional[str] = Field(default=None, description="Spotify uri of item to play for 'start' action. " +
                                                                 "If omitted, resumes current playback.")
    num_skips: Optional[int] = Field(default=1, description="Number of tracks to skip for `skip` action.")


class Queue(ToolModel):
    """Manage the playback queue - get the queue or add tracks."""
    action: str = Field(description="Action to perform: 'add' or 'get'.")
    track_id: Optional[str] = Field(default=None, description="Track ID to add to queue (required for add action)")


class GetInfo(ToolModel):
    """Get detailed information about a Spotify item (track, album, artist, or playlist)."""
    item_uri: str = Field(description="URI of the item to get information about. " +
                                      "If 'playlist' or 'album', returns its tracks. " +
                                      "If 'artist', returns albums and top tracks.")


class Search(ToolModel):
    """Search for tracks, albums, artists, or playlists on Spotify."""
    query: str = Field(description="query term")
    qtype: Optional[str] = Field(default="track",
                                 description="Type of items to search for (track, album, artist, playlist, " +
                                             "or comma-separated combination)")
    limit: Optional[int] = Field(default=10, description="Maximum number of items to return")


class Playlist(ToolModel):
    """Manage Spotify playlists.
    - get: Get a list of user's playlists.
    - get_tracks: Get tracks in a specific playlist.
    - add_tracks: Add tracks to a specific playlist.
    - remove_tracks: Remove tracks from a specific playlist.
    - change_details: Change details of a specific playlist.
    """
    action: str = Field(
        description="Action to perform: 'get', 'get_tracks', 'add_tracks', 'remove_tracks', 'change_details'.")
    playlist_id: Optional[str] = Field(default=None, description="ID of the playlist to manage.")
    track_ids: Optional[List[str]] = Field(default=None, description="List of track IDs to add/remove.")
    name: Optional[str] = Field(default=None, description="New name for the playlist.")
    description: Optional[str] = Field(default=None, description="New description for the playlist.")


class ResetAuth(ToolModel):
    """Reset Spotify authentication."""


@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return []


@server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    return []


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools."""
    logger.info("Listing available tools")
    # await server.request_context.session.send_notification("are you recieving this notification?")
    tools = [
        Playback.as_tool(),
        Search.as_tool(),
        Queue.as_tool(),
        GetInfo.as_tool(),
        Playlist.as_tool(),
        ResetAuth.as_tool(),
    ]
    logger.info(f"Available tools: {[tool.name for tool in tools]}")
    return tools


@server.call_tool()
async def handle_call_tool(
        name: str, arguments: dict | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Handle tool execution requests."""
    global spotify_client
    logger.info(f"Tool called: {name} with arguments: {arguments}")
    assert name[:7] == "Spotify", f"Unknown tool: {name}"
    try:
        match name[7:]:
            case "Playback":
                action = arguments.get("action")
                match action:
                    case "get":
                        logger.info("Attempting to get current track")
                        curr_track = spotify_client.get_current_track()
                        if curr_track:
                            logger.info(f"Current track retrieved: {curr_track.get('name', 'Unknown')}")
                            return [types.TextContent(
                                type="text",
                                text=json.dumps(curr_track, indent=2)
                            )]
                        logger.info("No track currently playing")
                        return [types.TextContent(
                            type="text",
                            text="No track playing."
                        )]
                    case "start":
                        logger.info(f"Starting playback with arguments: {arguments}")
                        spotify_client.start_playback(spotify_uri=arguments.get("spotify_uri"))
                        logger.info("Playback started successfully")
                        return [types.TextContent(
                            type="text",
                            text="Playback starting."
                        )]
                    case "pause":
                        logger.info("Attempting to pause playback")
                        spotify_client.pause_playback()
                        logger.info("Playback paused successfully")
                        return [types.TextContent(
                            type="text",
                            text="Playback paused."
                        )]
                    case "skip":
                        num_skips = int(arguments.get("num_skips", 1))
                        logger.info(f"Skipping {num_skips} tracks.")
                        spotify_client.skip_track(n=num_skips)
                        return [types.TextContent(
                            type="text",
                            text="Skipped to next track."
                        )]

            case "Search":
                logger.info(f"Performing search with arguments: {arguments}")
                search_results = spotify_client.search(
                    query=arguments.get("query", ""),
                    qtype=arguments.get("qtype", "track"),
                    limit=arguments.get("limit", 10)
                )
                logger.info("Search completed successfully.")
                return [types.TextContent(
                    type="text",
                    text=json.dumps(search_results, indent=2)
                )]

            case "Queue":
                logger.info(f"Queue operation with arguments: {arguments}")
                action = arguments.get("action")

                match action:
                    case "add":
                        track_id = arguments.get("track_id")
                        if not track_id:
                            logger.error("track_id is required for add to queue.")
                            return [types.TextContent(
                                type="text",
                                text="track_id is required for add action"
                            )]
                        spotify_client.add_to_queue(track_id)
                        return [types.TextContent(
                            type="text",
                            text=f"Track added to queue."
                        )]

                    case "get":
                        queue = spotify_client.get_queue()
                        return [types.TextContent(
                            type="text",
                            text=json.dumps(queue, indent=2)
                        )]

                    case _:
                        return [types.TextContent(
                            type="text",
                            text=f"Unknown queue action: {action}. Supported actions are: add, remove, and get."
                        )]

            case "GetInfo":
                logger.info(f"Getting item info with arguments: {arguments}")
                item_info = spotify_client.get_info(
                    item_uri=arguments.get("item_uri")
                )
                return [types.TextContent(
                    type="text",
                    text=json.dumps(item_info, indent=2)
                )]

            case "Playlist":
                logger.info(f"Playlist operation with arguments: {arguments}")
                action = arguments.get("action")
                match action:
                    case "get":
                        logger.info(f"Getting current user's playlists with arguments: {arguments}")
                        playlists = spotify_client.get_current_user_playlists()
                        return [types.TextContent(
                            type="text",
                            text=json.dumps(playlists, indent=2)
                        )]
                    case "get_tracks":
                        logger.info(f"Getting tracks in playlist with arguments: {arguments}")
                        if not arguments.get("playlist_id"):
                            logger.error("playlist_id is required for get_tracks action.")
                            return [types.TextContent(
                                type="text",
                                text="playlist_id is required for get_tracks action."
                            )]
                        tracks = spotify_client.get_playlist_tracks(arguments.get("playlist_id"))
                        return [types.TextContent(
                            type="text",
                            text=json.dumps(tracks, indent=2)
                        )]
                    case "add_tracks":
                        logger.info(f"Adding tracks to playlist with arguments: {arguments}")
                        track_ids = arguments.get("track_ids")
                        if isinstance(track_ids, str):
                            try:
                                track_ids = json.loads(track_ids)  # Convert JSON string to Python list
                            except json.JSONDecodeError:
                                logger.error("track_ids must be a list or a valid JSON array.")
                                return [types.TextContent(
                                    type="text",
                                    text="Error: track_ids must be a list or a valid JSON array."
                                )]

                        spotify_client.add_tracks_to_playlist(
                            playlist_id=arguments.get("playlist_id"),
                            track_ids=track_ids
                        )
                        return [types.TextContent(
                            type="text",
                            text="Tracks added to playlist."
                        )]
                    case "remove_tracks":
                        logger.info(f"Removing tracks from playlist with arguments: {arguments}")
                        track_ids = arguments.get("track_ids")
                        if isinstance(track_ids, str):
                            try:
                                track_ids = json.loads(track_ids)  # Convert JSON string to Python list
                            except json.JSONDecodeError:
                                logger.error("track_ids must be a list or a valid JSON array.")
                                return [types.TextContent(
                                    type="text",
                                    text="Error: track_ids must be a list or a valid JSON array."
                                )]

                        spotify_client.remove_tracks_from_playlist(
                            playlist_id=arguments.get("playlist_id"),
                            track_ids=track_ids
                        )
                        return [types.TextContent(
                            type="text",
                            text="Tracks removed from playlist."
                        )]

                    case "change_details":
                        logger.info(f"Changing playlist details with arguments: {arguments}")
                        if not arguments.get("playlist_id"):
                            logger.error("playlist_id is required for change_details action.")
                            return [types.TextContent(
                                type="text",
                                text="playlist_id is required for change_details action."
                            )]
                        if not arguments.get("name") and not arguments.get("description"):
                            logger.error("At least one of name, description or public is required.")
                            return [types.TextContent(
                                type="text",
                                text="At least one of name, description, public, or collaborative is required."
                            )]

                        spotify_client.change_playlist_details(
                            playlist_id=arguments.get("playlist_id"),
                            name=arguments.get("name"),
                            description=arguments.get("description")
                        )
                        return [types.TextContent(
                            type="text",
                            text="Playlist details changed."
                        )]

                    case _:
                        return [types.TextContent(
                            type="text",
                            text=f"Unknown playlist action: {action}."
                                 "Supported actions are: get, get_tracks, add_tracks, remove_tracks, change_details."
                        )]

            case "ResetAuth":
                logger.info("Resetting Spotify authentication")
                cache_path = spotify_client.cache_path
                if os.path.exists(cache_path):
                    os.remove(cache_path)
                    logger.info(f"Authentication cache file removed: {cache_path}")
                    
                    # Re-initialize the client to clear the in-memory token
                    spotify_client = spotify_api.Client(logger)
                    logger.info("Spotify client re-initialized to clear in-memory token.")

                    return [types.TextContent(type="text", text="Spotify authentication has been reset.")]
                else:
                    logger.info("No authentication cache file found to remove.")

            case _:
                error_msg = f"Unknown tool: {name}"
                logger.error(error_msg)
                return [types.TextContent(
                    type="text",
                    text=error_msg
                )]
    except SpotifyException as se:
        error_msg = f"Spotify Client error occurred: {str(se)}"
        logger.error(error_msg)
        return [types.TextContent(
            type="text",
            text=f"An error occurred with the Spotify Client: {str(se)}"
        )]
    except Exception as e:
        error_msg = f"Unexpected error occurred: {str(e)}"
        logger.error(error_msg)
        return [types.TextContent(
            type="text",
            text=error_msg
        )]


async def main():
    try:
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options()
            )
    except Exception as e:
        logger.error(f"Server error occurred: {str(e)}")
        raise
