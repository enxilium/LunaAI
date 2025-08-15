import os
import platform
import subprocess
import json
import webbrowser
import sqlite3
from typing import List, Dict, Any, Optional
from pathlib import Path

try:
    # Try relative import first (for normal package usage)
    from ..memory.memory_database import MemoryDatabase
except ImportError:
    # Fall back to absolute import (for direct execution)
    from memory.memory_database import MemoryDatabase

# Whoosh imports for fast searching
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, STORED
from whoosh.qparser import QueryParser
from whoosh.query import And, Or, Term
import tempfile
import threading

# Function to get singleton database instance
def _get_memory_db():
    """Get the singleton MemoryDatabase instance to ensure consistency across operations"""
    return MemoryDatabase.get_instance()

# Global variables for Whoosh index
_index_dir = None
_index = None
_index_lock = threading.Lock()
_index_initialized = False

def initialize_workspace_system():
    """Initialize Whoosh index for program searching - called at application start"""
    global _index_dir, _index, _index_initialized
    
    if _index_initialized:
        return  # Already initialized
    
    try:
        # Create temporary directory for index
        _index_dir = tempfile.mkdtemp(prefix="luna_program_index_")
        
        # Define schema for program index
        schema = Schema(
            name=TEXT(stored=True),
            path=ID(stored=True, unique=True),
            display_name=TEXT(stored=True),
            platform=STORED()
        )
        
        # Create index
        _index = create_in(_index_dir, schema)
        
        # Build index based on current platform
        _build_program_index()
        
        _index_initialized = True
        print("Luna: Workspace system initialized successfully")
        
    except Exception as e:
        print(f"Warning: Failed to initialize workspace system: {e}")
        _index = None
        _index_initialized = False

def _build_program_index():
    """Build the program index based on current platform"""
    global _index
    
    if not _index:
        return
        
    system = platform.system()
    
    with _index.writer() as writer:
        if system == "Windows":
            _index_windows_programs(writer)
        elif system == "Darwin":  # macOS
            _index_macos_programs(writer)
        elif system == "Linux":
            _index_linux_programs(writer)

def _index_windows_programs(writer):
    """Index Windows programs"""
    search_paths = [
        Path(os.environ.get('PROGRAMFILES', 'C:\\Program Files')),
        Path(os.environ.get('PROGRAMFILES(X86)', 'C:\\Program Files (x86)')),
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs',
        Path(os.environ.get('APPDATA', '')) / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs',
        Path('C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'),
        Path('C:\\Windows\\System32'),  # Windows system programs
        Path('C:\\Windows\\SysWOW64'),  # 32-bit programs on 64-bit Windows
    ]
    
    # Additional Start Menu locations
    start_menu_paths = [
        Path(os.environ.get('USERPROFILE', '')) / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs',
        Path('C:\\Users\\Public\\Desktop'),  # Public desktop shortcuts
        Path(os.environ.get('USERPROFILE', '')) / 'Desktop',  # User desktop shortcuts
    ]
    
    # Add Start Menu paths to main search paths
    search_paths.extend(start_menu_paths)
    
    for search_path in search_paths:
        if not search_path.exists():
            continue
            
        try:
            # For system directories, only look for .exe files to avoid too many results
            if 'System32' in str(search_path) or 'SysWOW64' in str(search_path):
                for file_path in search_path.glob('*.exe'):
                    if file_path.is_file():
                        writer.add_document(
                            name=file_path.stem.lower(),
                            path=str(file_path),
                            display_name=file_path.stem,
                            platform="Windows"
                        )
                        # Also index the full filename with extension for better matching
                        writer.add_document(
                            name=file_path.name.lower(),
                            path=str(file_path),
                            display_name=file_path.stem,
                            platform="Windows"
                        )
            else:
                # Search for .exe files and shortcuts in other directories
                for ext in ['*.exe', '*.lnk']:
                    for file_path in search_path.rglob(ext):
                        if file_path.is_file():
                            writer.add_document(
                                name=file_path.stem.lower(),
                                path=str(file_path),
                                display_name=file_path.stem,
                                platform="Windows"
                            )
                            # Also index the full filename with extension for better matching
                            writer.add_document(
                                name=file_path.name.lower(),
                                path=str(file_path),
                                display_name=file_path.stem,
                                platform="Windows"
                            )
        except (PermissionError, OSError):
            continue

def _index_macos_programs(writer):
    """Index macOS programs"""
    search_paths = [
        Path('/Applications'),
        Path('/System/Applications'),
        Path('/System/Library/CoreServices'),
        Path(os.path.expanduser('~/Applications')),
    ]
    
    # Additional macOS launcher locations
    launcher_paths = [
        Path('/System/Applications/Utilities'),  # System utilities
        Path('/Applications/Utilities'),  # User utilities
        Path(os.path.expanduser('~/Desktop')),  # Desktop aliases/shortcuts
        Path('/System/Library/LaunchAgents'),  # System launch agents
        Path(os.path.expanduser('~/Library/LaunchAgents')),  # User launch agents
    ]
    
    # Add launcher paths to main search paths
    search_paths.extend(launcher_paths)
    
    for search_path in search_paths:
        if not search_path.exists():
            continue
            
        try:
            # Handle .app bundles
            for app_path in search_path.glob('*.app'):
                if app_path.is_dir():
                    writer.add_document(
                        name=app_path.stem.lower(),
                        path=str(app_path),
                        display_name=app_path.stem,
                        platform="macOS"
                    )
            
            # Handle executable files in LaunchAgents and other directories
            if 'LaunchAgents' not in str(search_path):
                for file_path in search_path.iterdir():
                    if file_path.is_file() and os.access(file_path, os.X_OK):
                        # Skip hidden files and common non-program files
                        if not file_path.name.startswith('.') and not file_path.suffix in ['.txt', '.log', '.plist']:
                            writer.add_document(
                                name=file_path.stem.lower(),
                                path=str(file_path),
                                display_name=file_path.stem,
                                platform="macOS"
                            )
            else:
                # Handle .plist files in LaunchAgents for service discovery
                for plist_file in search_path.glob('*.plist'):
                    if plist_file.is_file():
                        writer.add_document(
                            name=plist_file.stem.lower(),
                            path=str(plist_file),
                            display_name=plist_file.stem,
                            platform="macOS"
                        )
        except (PermissionError, OSError):
            continue

def _index_linux_programs(writer):
    """Index Linux programs"""
    # Search in PATH
    path_dirs = os.environ.get('PATH', '').split(os.pathsep)
    
    for path_dir in path_dirs:
        path_obj = Path(path_dir)
        if not path_obj.exists():
            continue
            
        try:
            for file_path in path_obj.iterdir():
                if file_path.is_file() and os.access(file_path, os.X_OK):
                    writer.add_document(
                        name=file_path.name.lower(),
                        path=str(file_path),
                        display_name=file_path.name,
                        platform="Linux"
                    )
        except (PermissionError, OSError):
            continue
    
    # Search .desktop files (application launchers)
    search_paths = [
        Path('/usr/share/applications'),  # System-wide applications
        Path(os.path.expanduser('~/.local/share/applications')),  # User applications
        Path('/var/lib/snapd/desktop/applications'),  # Snap applications
        Path('/var/lib/flatpak/exports/share/applications'),  # Flatpak applications
        Path(os.path.expanduser('~/.local/share/flatpak/exports/share/applications')),  # User Flatpak
    ]
    
    # Additional launcher directories
    additional_paths = [
        Path(os.path.expanduser('~/Desktop')),  # Desktop files
        Path('/usr/local/share/applications'),  # Local applications
        Path('/opt'),  # Optional software packages
    ]
    
    # Add additional paths to main search paths
    search_paths.extend(additional_paths)
    
    for search_path in search_paths:
        if not search_path.exists():
            continue
            
        try:
            if search_path.name == 'opt':
                # Special handling for /opt directory - look for executable files
                for opt_dir in search_path.iterdir():
                    if opt_dir.is_dir():
                        # Look for bin directories in opt packages
                        bin_dirs = [opt_dir / 'bin', opt_dir / 'usr' / 'bin']
                        for bin_dir in bin_dirs:
                            if bin_dir.exists():
                                for file_path in bin_dir.iterdir():
                                    if file_path.is_file() and os.access(file_path, os.X_OK):
                                        writer.add_document(
                                            name=file_path.name.lower(),
                                            path=str(file_path),
                                            display_name=file_path.name,
                                            platform="Linux"
                                        )
            else:
                # Handle .desktop files and other executable files
                for file_path in search_path.glob('*'):
                    if file_path.is_file():
                        if file_path.suffix == '.desktop':
                            # Desktop entry files
                            writer.add_document(
                                name=file_path.stem.lower(),
                                path=str(file_path),
                                display_name=file_path.stem,
                                platform="Linux"
                            )
                        elif os.access(file_path, os.X_OK) and not file_path.name.startswith('.'):
                            # Executable files
                            writer.add_document(
                                name=file_path.name.lower(),
                                path=str(file_path),
                                display_name=file_path.name,
                                platform="Linux"
                            )
        except (PermissionError, OSError):
            continue

def _search_programs_with_whoosh(program_names: List[str]) -> List[Dict[str, str]]:
    """Search for programs using Whoosh index"""
    global _index, _index_initialized
    
    if not _index_initialized or not _index:
        print("Warning: Workspace system not initialized, initializing now...")
        initialize_workspace_system()
        if not _index:
            return []
    
    # Common program aliases
    program_aliases = {
        'calculator': ['calc', 'calculator'],
        'notepad': ['notepad', 'notepad++', 'text editor'],
        'browser': ['chrome', 'firefox', 'edge', 'msedge'],
        'terminal': ['cmd', 'powershell', 'bash'],
        'file manager': ['explorer', 'file explorer'],
        'paint': ['mspaint', 'paint'],
    }
    
    found_programs = []
    
    with _index.searcher() as searcher:
        parser = QueryParser("name", _index.schema)
        
        for program_name in program_names:
            query_text = program_name.lower()
            
            # Get all possible search terms (original + aliases)
            search_terms = [query_text]
            if query_text in program_aliases:
                search_terms.extend(program_aliases[query_text])
            
            best_match = None
            best_score = 0
            
            for search_term in search_terms:
                # Try exact match first, then fuzzy search
                queries = [
                    parser.parse(f'"{search_term}"'),  # Exact phrase
                    parser.parse(f'{search_term}*'),    # Prefix match
                    parser.parse(search_term)           # General search
                ]
                
                for query in queries:
                    results = searcher.search(query, limit=5)
                    
                    for result in results:
                        score = result.score
                        
                        # Additional scoring based on name similarity
                        name_score = _calculate_similarity(search_term, result['name'])
                        combined_score = (score + name_score) / 2
                        
                        if combined_score > best_score:
                            best_score = combined_score
                            best_match = {
                                'name': program_name,
                                'path': result['path'],
                                'found_name': result['display_name'],
                                'score': combined_score
                            }
                    
                    # If we found a good match, break early
                    if best_score > 0.5:
                        break
                
                # Break out of search terms loop if we found a good match
                if best_score > 0.5:
                    break
            
            if best_match and best_score > 0.2:  # Lower minimum threshold
                found_programs.append(best_match)
    
    return found_programs

def _calculate_similarity(query: str, target: str) -> float:
    """Calculate similarity score between query and target strings (0.0 - 1.0)"""
    query = query.lower().strip()
    target = target.lower().strip()
    
    # Exact match
    if query == target:
        return 1.0
    
    # Contains match
    if query in target:
        return 0.8
    
    # Reverse contains match
    if target in query:
        return 0.7
    
    # Word-based matching
    query_words = set(query.split())
    target_words = set(target.split())
    
    if query_words & target_words:  # Common words
        intersection = len(query_words & target_words)
        union = len(query_words | target_words)
        return 0.5 + (intersection / union) * 0.3
    
    # Character-based similarity (simple Jaccard)
    query_chars = set(query)
    target_chars = set(target)
    
    if query_chars & target_chars:
        intersection = len(query_chars & target_chars)
        union = len(query_chars | target_chars)
        return intersection / union * 0.4
    
    return 0.0

def _launch_programs_cross_platform(programs: List[Dict[str, str]]) -> Dict[str, Any]:
    """Launch programs across different platforms"""
    launched = []
    failed = []
    
    system = platform.system()
    
    for program in programs:
        try:
            path = program['path']
            
            if system == "Windows":
                if path.endswith('.lnk'):
                    # Launch shortcut
                    subprocess.Popen(['cmd', '/c', 'start', '', path], shell=True)
                else:
                    # Launch executable
                    subprocess.Popen(path, shell=True)
            elif system == "Darwin":  # macOS
                if path.endswith('.app'):
                    subprocess.Popen(['open', path])
                else:
                    subprocess.Popen(path, shell=True)
            elif system == "Linux":
                if path.endswith('.desktop'):
                    subprocess.Popen(['gtk-launch', path])
                else:
                    subprocess.Popen(path, shell=True)
            
            launched.append(program['found_name'])
            
        except (OSError, subprocess.SubprocessError) as e:
            failed.append({'program': program['found_name'], 'error': str(e)})
    
    return {
        'launched': launched,
        'failed': failed,
        'total_requested': len(programs),
        'total_launched': len(launched)
    }

def _launch_browser_links(links: List[str]) -> Dict[str, Any]:
    """Launch browser links using the user's default browser"""
    launched = []
    failed = []
    
    for link in links:
        try:
            # Validate URL format
            if not link.startswith(('http://', 'https://', 'file://')):
                # Special handling for localhost
                if link.startswith('localhost'):
                    link = f"http://{link}"
                # Assume it's a regular web URL and add https://
                elif '.' in link and not link.startswith('www.'):
                    link = f"https://{link}"
                elif link.startswith('www.'):
                    link = f"https://{link}"
                else:
                    # Skip invalid links
                    failed.append({'link': link, 'error': 'Invalid URL format'})
                    continue
            
            # Use webbrowser module to open in default browser
            webbrowser.open(link)
            launched.append(link)
            
        except Exception as e:
            failed.append({'link': link, 'error': str(e)})
    
    return {
        'launched': launched,
        'failed': failed,
        'total_requested': len(links),
        'total_launched': len(launched)
    }

def create_workspace(programs: List[str], name: Optional[str] = None, description: Optional[str] = None, links: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Create a new workspace by finding and saving the specified programs and browser links.
    The workspace is saved to the database for future use. Use launch_workspace() to actually launch it.
    
    Args:
        programs: List of program names to search for and include in the workspace
        name: Optional name for the workspace (auto-generated if not provided)
        description: Optional description for the workspace
        links: Optional list of browser links/URLs to open in the default browser
        
    Returns:
        Dict containing workspace creation results (does not launch programs/links)
    """
    try:
        # Search for programs based on current OS to validate they exist
        found_programs = _search_programs_with_whoosh(programs) if programs else []
        
        # Validate and clean links
        clean_links = []
        if links:
            for link in links:
                if link and link.strip():
                    clean_links.append(link.strip())
        
        if not found_programs and not clean_links:
            return {
                "status": "error",
                "message": "No programs or links provided",
                "requested": {"programs": programs, "links": links}
            }
        
        # Generate workspace name if not provided
        if not name:
            components = []
            if found_programs:
                components.extend([p['found_name'] for p in found_programs[:2]])
            if clean_links:
                # Extract domain names from links for naming
                for link in clean_links[:2]:
                    try:
                        if '://' in link:
                            domain = link.split('://')[1].split('/')[0]
                        else:
                            domain = link.split('/')[0]
                        # Clean domain name
                        domain = domain.replace('www.', '').split('.')[0]
                        components.append(domain)
                    except:
                        continue
            
            if components:
                name = f"Workspace_{'-'.join(components[:3])}"[:50]  # Limit length
            else:
                name = "Custom_Workspace"
        
        # Save workspace to database (without launching)
        workspace_id = _get_memory_db().add_workspace(
            name=name,
            programs=programs if programs else [],  # Store original requested programs
            description=description,
            links=clean_links
        )
        
        result = {
            "status": "success",
            "workspace_id": workspace_id,
            "workspace_name": name,
            "requested_programs": programs if programs else [],
            "requested_links": clean_links,
            "message": f"Workspace '{name}' created successfully. Use launch_workspace('{name}') to launch it."
        }
        
        if found_programs:
            result["found_programs"] = [
                {
                    "requested": p['name'],
                    "found": p['found_name'],
                    "path": p['path'],
                    "score": p['score']
                } for p in found_programs
            ]
        
        return result
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to create workspace: {str(e)}"
        }

def create_and_launch_workspace(programs: List[str], name: str, description: Optional[str] = None, links: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Create a new workspace and immediately launch it.
    This is a convenience function that combines create_workspace() and launch_workspace().
    
    Args:
        programs: List of program names to search for and include in the workspace
        name: Optional name for the workspace (auto-generated if not provided)
        description: Optional description for the workspace
        links: Optional list of browser links/URLs to open in the default browser
        
    Returns:
        Dict containing workspace creation and launch results
    """
    try:
        # First create the workspace
        create_result = create_workspace(programs, name, description, links)
        
        if create_result['status'] != 'success':
            return create_result
        
        # Then launch it
        workspace_name = create_result['workspace_name']
        launch_result = launch_workspace(workspace_name)
        
        if launch_result['status'] != 'success':
            return {
                "status": "partial_success",
                "message": f"Workspace '{workspace_name}' created but failed to launch: {launch_result['message']}",
                "create_result": create_result,
                "launch_error": launch_result['message']
            }
        
        # Combine results
        return {
            "status": "success",
            "workspace_id": create_result['workspace_id'],
            "workspace_name": workspace_name,
            "requested_programs": create_result['requested_programs'],
            "requested_links": create_result['requested_links'],
            "found_programs": create_result.get('found_programs', []),
            "launch_results": launch_result['launch_results'],
            "message": f"Workspace '{workspace_name}' created and launched successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to create and launch workspace: {str(e)}"
        }

def launch_workspace(name: str) -> Dict[str, Any]:
    """
    Launch an existing workspace by name.
    
    Args:
        name: Name of the workspace to launch
        
    Returns:
        Dict containing launch results
    """
    try:
        # Get workspace from database
        workspace = _get_memory_db().get_workspace_by_name(name)
        if not workspace:
            return {
                "status": "error",
                "message": f"Workspace '{name}' not found"
            }
        
        # Get programs and links from workspace
        programs = workspace['programs']
        links = workspace['links']
        
        found_programs = []
        if programs:
            found_programs = _search_programs_with_whoosh(programs)
        
        if not found_programs and not links:
            return {
                "status": "error",
                "message": "No programs or links found for this workspace",
                "workspace": name,
                "programs": programs,
                "links": links
            }
        
        # Launch programs and links
        launch_results = {}
        
        if found_programs:
            launch_results['programs'] = _launch_programs_cross_platform(found_programs)
        
        if links:
            launch_results['links'] = _launch_browser_links(links)
        
        # Update workspace usage
        _get_memory_db().update_workspace_usage(workspace['id'])
        
        return {
            "status": "success",
            "workspace_name": name,
            "launch_results": launch_results,
            "message": f"Workspace '{name}' launched successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to launch workspace: {str(e)}"
        }

def list_workspaces() -> Dict[str, Any]:
    """
    List all saved workspaces.
    
    Returns:
        Dict containing list of workspaces
    """
    try:
        workspaces = _get_memory_db().get_workspaces()
        
        return {
            "status": "success",
            "workspaces": [
                {
                    "id": ws["id"],
                    "name": ws["name"],
                    "description": ws["description"],
                    "programs": ws["programs"],
                    "links": ws["links"],
                    "usage_count": ws["usage_count"],
                    "last_used": ws["last_used"]
                } for ws in workspaces
            ],
            "total": len(workspaces)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to list workspaces: {str(e)}"
        }

def search_workspaces(query: str) -> Dict[str, Any]:
    """
    Search for workspaces by name, description, programs, or links.
    
    Args:
        query: Search query
        
    Returns:
        Dict containing search results
    """
    try:
        workspaces = _get_memory_db().search_workspaces(query)
        
        return {
            "status": "success",
            "query": query,
            "workspaces": [
                {
                    "id": ws["id"],
                    "name": ws["name"],
                    "description": ws["description"],
                    "programs": ws["programs"],
                    "links": ws["links"],
                    "usage_count": ws["usage_count"],
                    "last_used": ws["last_used"]
                } for ws in workspaces
            ],
            "total": len(workspaces)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to search workspaces: {str(e)}"
        }

def delete_workspace(name: str) -> Dict[str, Any]:
    """
    Delete a workspace by name.
    
    Args:
        name: Name of the workspace to delete
        
    Returns:
        Dict containing deletion result
    """
    try:
        workspace = _get_memory_db().get_workspace_by_name(name)
        if not workspace:
            return {
                "status": "error",
                "message": f"Workspace '{name}' not found"
            }
        
        success = _get_memory_db().delete_workspace(workspace['id'])
        
        if success:
            return {
                "status": "success",
                "message": f"Workspace '{name}' deleted successfully"
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to delete workspace '{name}'"
            }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to delete workspace: {str(e)}"
        }

def clear_all_workspaces() -> Dict[str, Any]:
    """
    Clear all workspaces from the database. Useful for debugging and cleanup.
    
    Returns:
        Dict containing the operation result
    """
    try:
        db = _get_memory_db()
        
        # Get count before deletion
        workspaces = db.get_workspaces()
        count_before = len(workspaces)
        
        # Clear all workspace data
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM workspaces")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='workspaces'")
            conn.commit()
            deleted_count = cursor.rowcount
        
        return {
            "status": "success",
            "message": f"Cleared {count_before} workspace(s) from database",
            "deleted_count": count_before
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to clear workspaces: {str(e)}"
        }

def get_workspace_stats() -> Dict[str, Any]:
    """
    Get statistics about the workspace database for debugging.
    
    Returns:
        Dict containing workspace statistics
    """
    try:
        db = _get_memory_db()
        
        workspaces = db.get_workspaces()
        
        # Calculate stats
        total_workspaces = len(workspaces)
        workspaces_with_programs = len([w for w in workspaces if w['programs']])
        workspaces_with_links = len([w for w in workspaces if w['links']])
        
        # Get unique workspace names for debugging
        workspace_names = [w['name'] for w in workspaces]
        
        return {
            "status": "success",
            "stats": {
                "total_workspaces": total_workspaces,
                "workspaces_with_programs": workspaces_with_programs,
                "workspaces_with_links": workspaces_with_links,
                "workspace_names": workspace_names,
                "database_path": db.db_path
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to get workspace stats: {str(e)}"
        }

# Workspace system will be initialized by agent_runner at application start    