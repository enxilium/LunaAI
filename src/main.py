import os
import requests
from requests.exceptions import ConnectionError
import time
import io

import auxiliary as luna

import json

import speech_recognition as sr
from googleapiclient.discovery import build
from googlesearch import search
import webbrowser
import wikipedia
import wolframalpha
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import simpleaudio as sa
from PIL import Image
import spacy
from spacy.matcher import Matcher
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pyperclip

# <------ INITIALIZATION ------>

ACTIVATION_WORD = ""
SPOTIFY_DEVICE_ID = ""
CACHED_VOLUME = 0
COBALT_API_ENDPOINT = ""
DOWNLOADS_PATH = ""
GOOGLE_SEARCH_API = ""
GOOGLE_CSE_ID = ""
WOLFRAMALPHA_APP_ID = ""
DESKTOP_PATH = ""
SERVICE = ""
sp = None
data = None
saved_applications = None

def initialize():
    print("Initializing...")
    global ACTIVATION_WORD, SPOTIFY_DEVICE_ID, CACHED_VOLUME, COBALT_API_ENDPOINT, DOWNLOADS_PATH, GOOGLE_SEARCH_API, \
    GOOGLE_CSE_ID, WOLFRAMALPHA_APP_ID, DESKTOP_PATH, sp, data, saved_applications, SERVICE

    ACTIVATION_WORD = "luna"

    with open('./data/settings.json', 'r') as f:
        data = json.load(f)
    try :
        with open('./data/applications.json', 'r') as f:
            saved_applications = json.load(f)['applications']
            print(type(saved_applications))
    except FileNotFoundError:
        applications = luna.get_applications()
        luna.save_applications(applications)
        saved_applications = applications

    # SPOTIFY API
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=3)
    session.mount('https://', adapter)
    CACHED_VOLUME = int(data['previousSession']['cachedVolume'])

    # COBALT API
    COBALT_API_ENDPOINT = "http://localhost:9000/"
    DOWNLOADS_PATH = os.path.join(os.path.expanduser("~"), "Downloads")

    # GOOGLE SEARCH API
    GOOGLE_SEARCH_API = data['apiKeys']['google_search_api']
    GOOGLE_CSE_ID = data['apiKeys']['google_cse_id']

    # WOLFRAM ALPHA API
    WOLFRAMALPHA_APP_ID = data['apiKeys']['wolframalpha_api']

    DESKTOP_PATH = os.path.join(os.path.expanduser("~"), "Desktop")

    sp = spotipy.Spotify(
        auth_manager=SpotifyOAuth(
            client_id=data['apiKeys']['spotify_client_id'],
            client_secret=data['apiKeys']['spotify_client_secret'],
            redirect_uri="http://localhost:1234", # throwaway redirect uri, not used
            scope="user-read-playback-state,user-modify-playback-state"
            ), requests_session=session)

    # Get available devices
    devices = sp.devices()

    # Identify the active device or pick the first available
    if devices['devices']:
        SPOTIFY_DEVICE_ID = devices['devices'][0]['id']  # Select the first available device
        print(f"Spotify selected device: {devices['devices'][0]['name']}")
    else:
        print("No available devices found.")
    
    # Google OAuth

    GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar"]

    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists("./data/token.json"):
        creds = Credentials.from_authorized_user_file("./data/token.json", GOOGLE_SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "./data/credentials.json", GOOGLE_SCOPES
            )
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open("./data/token.json", "w") as token:
            token.write(creds.to_json())
    try:
        SERVICE = build("calendar", "v3", credentials=creds)
    except HttpError as error:
        print(f"An error occurred: {error}")

# <------ COMMANDS ------>

# <---- Operational ---->
def close(query: str):
    global data

    speak("All systems shutting down. Goodbye.")
    print("Saving settings...")
    luna.save_settings(data)
    exit()

def refreshApplications(query: str):
    global saved_applications

    print("Rescanning system for new applications...")

    applications = luna.get_applications()

    saved_applications = applications

    luna.save_applications(applications)

    speak("Applications refreshed.")

# <---- Spotify ---->
def playSpotify(query: str):
    global SPOTIFY_DEVICE_ID

    title = " ".join(query)

    max_retries = 10
    retries = 0

    while retries < max_retries:
        try:
            my_playlists = [playlist['name'] for playlist in sp.current_user_playlists(limit=50)['items']]
            print(my_playlists)

            if title in my_playlists:
                speak(f"Now playing {title}.")
                playlist_id = [playlist['id'] for playlist in sp.current_user_playlists(limit=50)['items'] if playlist['name'] == title][0]
                
                sp.start_playback(device_id=SPOTIFY_DEVICE_ID, context_uri=f"spotify:playlist:{playlist_id}")
            else:
                search_results = sp.search(q=title.replace(" ", "%20"), limit=1, type='track,album,playlist')
                try:
                    track_id = search_results['tracks']['items'][0]['uri']
                    sp.start_playback(device_id=SPOTIFY_DEVICE_ID, uris=[track_id])
                    speak(f"Now playing {title}.")
                except:
                    speak(f"Sorry, I couldn't find {title} in your playlists or as a track.")
            break

        except ConnectionError as e:
            print(f"Error encountered: {e}")
            print(f"Retrying... (Attempt {retries + 1} of {max_retries})")
            retries += 1
            time.sleep(1)
    else:
        print(f"Failed to add chunk to playlist after {max_retries} attempts. Skipping...")
        retries = 0

def pauseSpotify(query: str):
    sp.pause_playback()
    speak("Music paused.")

def volumeSpotify(query: str):
    global CACHED_VOLUME;
    global data;

    volume = query[0]
    
    if volume == "up":
        new_volume = CACHED_VOLUME + 25
    elif volume == "down":
        new_volume = CACHED_VOLUME - 25
    else:
        speak("Sorry, I didn't catch that. Please specify volume up or down.")
        return
    
    sp.volume(new_volume)
    speak(f"Volume set to {new_volume} percent.")
    CACHED_VOLUME = new_volume

    data["previousSession"]["cachedVolume"] = CACHED_VOLUME

def queueSpotify(query: str):
    global SPOTIFY_DEVICE_ID

    title = " ".join(query)

    max_retries = 10
    retries = 0

    while retries < max_retries:
        try:
            search_results = sp.search(q=title.replace(" ", "%20"), limit=1, type='track')
            try:
                track_id = search_results['tracks']['items'][0]['uri']
                sp.add_to_queue(device_id=SPOTIFY_DEVICE_ID, uri=[track_id])
                speak(f"Added {title} to queue.")
            except:
                speak(f"Sorry, I couldn't find the specified song.")
        except ConnectionError as e:
            print(f"Error encountered: {e}")
            print(f"Retrying... (Attempt {retries + 1} of {max_retries})")
            retries += 1
            time.sleep(1)
    else:
        print(f"Failed to add chunk to playlist after {max_retries} attempts. Skipping...")
        retries = 0

# <---- Downloading ---->
def downloadFile(query: str):
    query = " ".join(query)
    result_link = luna.google_search(query, GOOGLE_SEARCH_API, GOOGLE_CSE_ID)

    speak("Sure! Would you like the file in mp4 or mp3 format?")
    
    response = ""
    mode = "auto"

    while True:
        response = parseCommand(timeout=5)
        if response:
            response = response.lower()
            if response == "mp3":
                mode = "audio"
                speak("Okay, downloading mp3...")
                break
            elif response == "mp4":
                mode = "auto"
                speak("Okay, downloading mp4...")
                break

        speak("Sorry, I didn't catch that. Please specify mp3 or mp4.")
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    data = {
        "url": result_link,
        "downloadMode": mode
    }

    print(data)

    api_response = requests.post(COBALT_API_ENDPOINT, headers=headers, json=data)
    try:
        file_url = requests.get(api_response.json().get('url'), stream=True)
        file_name = api_response.json().get('filename')

        print(file_url, file_name)

        with open(os.path.join(DOWNLOADS_PATH, file_name), "wb") as file:
            for chunk in file_url.iter_content(chunk_size=8192):
                file.write(chunk)
        
        luna.remux_file(os.path.join(DOWNLOADS_PATH, file_name), os.path.join(DOWNLOADS_PATH, query + "." + response))
    except Exception as e:
        print(e)

# <---- Computational ---->
def compute(query: str):
    if "matrix" in query:
        idx = query.index("matrix")
        query = luna.take_matrix_input(" ".join(query).replace(",", " comma").split(), idx)

    app_id = WOLFRAMALPHA_APP_ID
    client = wolframalpha.Client(app_id)

    try:
        res = client.query(" ".join(query))
        img_url = next(res.results).subpod.img.src
        pyperclip.copy(img_url)

        speak("The result has been copied to your clipboard!")
    except Exception as e:
        print(e)
        speak("Sorry, I couldn't understand your query. Please try again.")

# <---- Workflow ---->
def openSetup(query: str):
    global data
    global saved_applications

    query = " ".join(query)

    setups = data['setups']

    if query in setups:
        speak("Opening setup...")
        for app in setups[query]:
            os.startfile(saved_applications[app])
    else:
        speak("Sorry, I couldn't find the specified setup.")

def createSetup(query: str):
    global data
    global saved_applications

    speak("Sure! Please specify the name of the setup.")

    response = ""
    setup_name = ""
    setup_applications = []

    while True:
        response = parseCommand(timeout=5)
        if response is not None:
            response = response.lower()
            if response == "cancel":
                speak("Setup creation cancelled.")
                return
            else:
                print(response)
                setup_name = response
                break
        speak("Sorry, I didn't catch that. Please try again, or say CANCEL to cancel.")
    
    speak(f"Understood. What applications would you like to open in the setup {setup_name}?")

    while True:
        response = parseCommand(timeout=5)
        if response:
            response = response.lower()
            if response == "cancel":
                speak("Setup creation cancelled.")
                return
            else:
                match = luna.find_matching_phrases(response, saved_applications)
                setup_applications, unfound_applications = match[0], match[1]

                # In case user has installed more programs since last refresh
                if len(unfound_applications) > 0:
                    speak("I didn't find some applications. Refreshing automatically...")
                    refreshApplications(None)
                    match = luna.find_matching_phrases(response, saved_applications)
                    print(match)
                    setup_applications, unfound_applications = match[0], match[1]

                speak("The applications you want to include are " + ", ".join(setup_applications) + ". Is that correct?")
                while True:
                    response = parseCommand(timeout=5)
                    if response:
                        response = response.lower()
                        if response == "cancel":
                            speak("Setup creation cancelled.")
                            return
                        if response == "yes":
                            break
                        elif response == "no":
                            speak("Okay, let's try again.")
                            break
                        else:
                            speak("Sorry, I didn't catch that. Please try again.")
                if response == "yes":
                    speak("Okay! Initializing setup creation...")
                    break
                else:
                    speak("Please specify the applications you would like to include.")
                    continue

        speak("Sorry, I didn't catch that. Please try again, or say CANCEL to cancel.")

    data['setups'][setup_name] = setup_applications

    luna.save_settings(data)

    speak("Setup creation successful!")

def addCalendarEvent(query: str):
    global SERVICE

    start, end = luna.parseDateTime(" ".join(query))
    speak("Sure! Please specify the event title.")

    while True:
        event_description = parseCommand(timeout=5)
        if event_description:
            break
        speak("Sorry, I didn't catch that. Please try again.")
    
    speak("Got it. Would you like to add a physical location to the event?")

    while True:
        response = parseCommand(timeout=5)
        if response.lower() == "yes" or response.lower() == "no":
            break
        speak("Sorry, I didn't catch that. Please try again.")
    
    location = ""

    if response.lower() == "yes":
        speak("Please specify the location.")
        while True:
            location = parseCommand(timeout=5)
            if location:
                break
            speak("Sorry, I didn't catch that. Please try again.")
    
    event = {
        'summary': event_description,
        'description': event_description,
        'location': location,
        'start': {
            'dateTime': start,
            'timeZone': 'America/New_York',
        },
        'end': {
            'dateTime': end,
            'timeZone': 'America/New_York',
        },
        }

    event = SERVICE.events().insert(calendarId='primary', body=event).execute()
    print('Event created: %s' % (event.get('htmlLink')))

    speak(f"Understood. Added {event_description} to your calendar.")

# Command Dictionary
commands = {
    "play" : playSpotify, # play music
    "pause" : pauseSpotify, # pause music
    "volume" : volumeSpotify, #change volume
    "queue" : queueSpotify, # queue a song
    "download" : downloadFile, # download a file from the internet
    "compute": compute, # WolframAlpha
    "refresh" : refreshApplications,
    "create" : createSetup,
    "open" : openSetup,
    "schedule" : addCalendarEvent,
    "exit" : close
}

def speak(input_text):
    textToSpeak = input_text
    urlPiper = "http://localhost:5000" # Flask endpoint served from WSL
    outputFilename = "./output/output.wav"

    payload = {'text': textToSpeak}

    # GET request
    r = requests.get(urlPiper,params=payload)

    # Save the audio file
    with open(outputFilename, 'wb') as fd:
        for chunk in r.iter_content(chunk_size=128):
            fd.write(chunk)
    
    # Play the sound
    wave_obj = sa.WaveObject.from_wave_file(outputFilename)
    play_obj = wave_obj.play()

    play_obj.wait_done()

def parseCommand(timeout):
    """
    Function to parse the command from the user.
    """
    listener = sr.Recognizer()
    print("Listening...")

    try:
        with sr.Microphone() as source:
            listener.adjust_for_ambient_noise(source, duration=1)
            listener.dynamic_energy_threshold = True
            listener.pause_threshold = 1 
            input_speech = listener.listen(source)
            print("Recognizing...")
            query = listener.recognize_google(input_speech, language="en-us")
            print(f"Received Input: {query}\n")
    except sr.WaitTimeoutError:
            print("Timeout: No speech detected. Restarting listener...")
            return None  # Return None to indicate no command was detected
    except Exception as e:
        print("Couldn't quite catch that...")
        print(e)

        return "None"

    return query

def callLLM(query):
    """
    Function that calls the Gemini API and generate a response.
    """
    speak("request received.")

def main():
    global saved_applications
    
    initialize();

    speak("Luna activated. All systems operational. How can I help you today?")

    while True:
        query = parseCommand(timeout=5)

        if query:
            query = query.lower().split()
            # check for activation word
            if ACTIVATION_WORD in query:
                idx = query.index(ACTIVATION_WORD)
                query = query[idx+1:] if idx < len(query) - 1 else []

                print(query)

                if query[0] in commands:
                    commands[query[0]](query[1:])
                else:
                    callLLM(" ".join(query))

if __name__ == "__main__":
    main()