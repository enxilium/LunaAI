import os
import requests
from requests.exceptions import ConnectionError
import time
import io

import auxiliary as luna

import json
import google.generativeai as genai
import sounddevice as sd
from googleapiclient.discovery import build
from googlesearch import search
import webbrowser
import wikipedia
import queue
import vosk
import wolframalpha
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import simpleaudio as sa
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import traceback
import pyperclip
import subprocess


# <------ INITIALIZATION ------>

ACTIVATION_WORD = ""
SPOTIFY_DEVICE_ID = ""
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
model = None
sr_model = None
q = None

def initialize():
    print("Initializing...")
    global ACTIVATION_WORD, SPOTIFY_DEVICE_ID, COBALT_API_ENDPOINT, DOWNLOADS_PATH, GOOGLE_SEARCH_API, \
    GOOGLE_CSE_ID, WOLFRAMALPHA_APP_ID, DESKTOP_PATH, sp, data, saved_applications, SERVICE, model, listener, q, sr_model

    ACTIVATION_WORD = "luna"

    try:
        subprocess.Popen("wsl bash -c \"cd ~/Projects/LunaAI/cobalt && docker compose up -d\"", shell=True)
        subprocess.Popen("wsl bash -c \"cd ~/Projects/LunaAI && source .venv/bin/activate && cd models && python3.10 -m piper.http_server --model en_US-hfc_female-medium.onnx\"", shell=True)
        print("Servers started.")
    except Exception as e:
        print(f"Error starting servers: {e}")
        exit()

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

    # COBALT API
    COBALT_API_ENDPOINT = "https://cobalt.api.timelessnesses.me"
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

    instructions = "You are Luna, an AI desktop assistant who is both friendly and helpful. You are designed \
            with several commands, such as playing music (play <song>), pausing music (pause), changing volume (volume up/down), \
            downloading files from the internet (download <file>), computing mathematical queries (compute <query>), \
            , creating setups (create <setup>), opening setups (open <setup>), scheduling events (schedule <event>), and exiting the program (exit). \
            If prompted, you should provide users with instructions on how to use your commands: say your name followed by the command name. \
            Respond in only plaintext English at all times, ignoring formatting such as asterisks or underscores. Also, your responses should be concise to maximize efficiency."

    # Gemini initialization
    genai.configure(api_key=data['apiKeys']['gemini_key'])
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=instructions)
    
    # Initialize the recognizer and queue
    sr_model = vosk.Model("vosk")  # Replace with your model path, e.g., "vosk-model-en-us-0.22"
    q = queue.Queue()

# <------ COMMANDS ------>

# <---- Operational ---->
def close(query: str):

    global data

    speak("All systems shutting down. Goodbye.")
    print("Saving settings...")
    luna.save_settings(data)
    print("Settings saved.")
    print("Shutting down servers...")
    subprocess.run("wsl --shutdown", shell=True)
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

    currentVolume = sp.current_playback()['device']['volume_percent']

    volume = query[0]
    
    if volume == "up":
        new_volume = min(currentVolume + 25, 100)
    elif volume == "down":
        new_volume = max(0, currentVolume - 25)
    else:
        speak("Sorry, I didn't catch that. Please specify volume up or down.")
        return
    
    sp.volume(new_volume)
    speak(f"Volume set to {new_volume} percent.")

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

    speak("Sure! Would you like the file in video or audio format?")
    
    response = ""
    mode = "auto"

    response = parseCommand(["video", "audio"]).lower().split()

    if "audio" in response:
        mode = "audio"
        response = "mp3"
        speak("Okay, downloading audio...")
    elif "video" in response:
        mode = "auto"
        response = "mp4"
        speak("Okay, downloading video...")

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    data = {
        "url": result_link,
        "downloadMode": mode
    }
    
    api_response = requests.post(COBALT_API_ENDPOINT, headers=headers, json=data)
    try:
        file_url = requests.get(api_response.json().get('url'), stream=True)
        file_name = api_response.json().get('filename')

        with open(os.path.join(DOWNLOADS_PATH, file_name), "wb") as file:
            for chunk in file_url.iter_content(chunk_size=8192):
                file.write(chunk)
        
        luna.remux_file(os.path.join(DOWNLOADS_PATH, file_name), os.path.join(DOWNLOADS_PATH, query + "." + response))
    except Exception as e:
        print(traceback.format_exc())

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

    response = parseCommand(anyInput=True).lower().split()

    if "cancel" in response:
        speak("Setup creation cancelled.")
        return
    else:
        setup_name = response

    while True:
        speak(f"Understood. What applications would you like to open in the setup {setup_name}?")

        response = parseCommand(anyInput=True).lower().split()

        if "cancel" in response:
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

            response = parseCommand(["yes", "no", "cancel"]).lower().split()

            if "cancel" in response:
                speak("Setup creation cancelled.")
                return
            elif "yes" in response:
                speak("Okay! Initializing setup creation...")
                break

    data['setups'][setup_name] = setup_applications

    luna.save_settings(data)

    speak("Setup creation successful!")

def addCalendarEvent(query: str):
    global SERVICE

    start, end = luna.parseDateTime(" ".join(query))
    speak("Sure! Please specify the event title.")

    event_description = parseCommand(anyInput=True)
    
    speak("Got it. Would you like to add a physical location to the event?")

    response = parseCommand(["yes", "no"]).lower().split()    
    
    location = ""

    if "yes" in response:
        speak("Please specify the location.")
        location = parseCommand(anyInput=True).lower().split()
    
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


def audio_callback(indata, frames, time, status):
    """
    Callback function to receive audio data in real-time.
    """
    global q

    if status:
        print(f"Audio Status: {status}")
    q.put(bytes(indata))

def parseCommand(activation_words: list[str], anyInput=False):
    """
    Function to parse the command from the user.
    """
    global sr_model

    print(f"Listening for activation words: '{activation_words}'")
    with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype="int16",
                           channels=1, callback=audio_callback):
        rec = vosk.KaldiRecognizer(sr_model, 16000)

        while True:
            data = q.get()
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                print(f"Recognized: {result.get('text')}")

                if len(result.get("text", "").split()) > 0 and anyInput:
                    return result.get('text')

                if any({word in result.get("text", "").lower().split() for word in activation_words}):
                    return result.get('text')
            else:
                partial = json.loads(rec.PartialResult())

                if len(partial.get("text", "").split()) > 0 and anyInput:
                    return partial.get('text')
                if any({word in partial.get("text", "").lower().split() for word in activation_words}):
                    return partial.get("text", "")

def callLLM(query):
    """
    Function that calls the Gemini API and generate a response.
    """
    global model

    response = model.generate_content(query)

    speak(response.text)

def main():
    global saved_applications
    
    initialize();

    speak("Luna activated. All systems operational. How can I help you today?")

    while True:
        query = parseCommand([ACTIVATION_WORD]).lower().split()

        print(query)

        idx = query.index(ACTIVATION_WORD)
        parsed = query[idx+1:] if idx < len(query) - 1 else [-1]

        print(parsed)

        if parsed[0] in commands:
            commands[parsed[0]](parsed[1:])
        else:
            callLLM(" ".join(query))

if __name__ == "__main__":
    main()