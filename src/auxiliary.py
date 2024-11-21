from googleapiclient.discovery import build
import subprocess
import os
import platform
import json
from pathlib import Path
import win32com.client  # Requires `pywin32` package for reading `.lnk` files
import spacy
import dateparser
from datetime import datetime, timedelta

nlp = spacy.load("en_core_web_sm")

def google_search(query, api_key, cse_id):
        service = build("customsearch", "v1", developerKey=api_key)
        res = service.cse().list(q=query, cx=cse_id).execute()
        return res['items'][0]['link']  # Return the first result's link

def remux_file(input_file, output_file):
    try:
        # Run the FFmpeg command to remux the video
        subprocess.run(['ffmpeg', '-i', input_file, '-c', 'copy', output_file], check=True)
        print(f"Remuxing completed. Output saved to {output_file}")
        os.remove(input_file)
    except subprocess.CalledProcessError as e:
        print(f"Error during remuxing: {e}")

def take_matrix_input(query, idx):
    
    matrix = "[["
    print(type(query))
    
    for i in range(idx + 1, len(query)):
        if query[i] == "negative" or query[i] == "-":
            try:
                query[i + 1] = "-" + query[i + 1]
                continue
            except IndexError:
                print("Index out of bounds!")
     
        if query[i] == "comma" or query[i] == ",":
            matrix = matrix[:-1]
            matrix += "], ["
        else:
            matrix += query[i] + ","

        print(matrix)

    matrix = matrix[:-1] + "]]"

    return query[:idx + 1] + [matrix]

def save_settings(data):
    with open("./data/settings.json", "w") as f:
        json.dump(data, f, indent=4)

def save_applications(apps):
    with open("./data/applications.json", "w") as f:
        json.dump({"applications": apps}, f, indent=4)

def get_applications():
    # Paths to Start Menu directories

    if platform.system() == "Windows":
        start_menu_paths = [
            Path("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
            Path.home() / "AppData/Roaming/Microsoft/Windows/Start Menu/Programs"
        ]
    elif platform.system() == "Darwin":
        start_menu_paths = [
            Path.home() / ".local/share/applications",
            Path("/usr/share/applications")
        ]

    # List to store discovered applications
    applications = {}

    # COM object to handle shortcut files
    shell = win32com.client.Dispatch("WScript.Shell")

    for start_menu_path in start_menu_paths:
        for root, dirs, files in os.walk(start_menu_path):
            for file in files:
                if file.endswith(".lnk"):
                    shortcut_path = os.path.join(root, file)
                    shortcut = shell.CreateShortcut(shortcut_path)
                    if shortcut.TargetPath != "":
                        name = file.replace(".lnk", "").lower()
                        target = shortcut.TargetPath
                        applications[name] = target
    
    return applications

def find_matching_phrases(query, collection):
    # Sliding Window Technique
    matches = []
    matched_words = []
    query = query.lower().split(" ")
    # Start with largest possible window
    for window_size in range(len(query), 0, -1):
        i = 0
        # While i + window size is still within bounds
        while i + window_size <= len(query):
            phrase = " ".join(query[i:i + window_size])
            if phrase in collection:
                matches.append(phrase)
                matched_words.extend(phrase.split(" "))
                i += window_size
            else:
                i += 1
            
    unmatched_words = [word for word in query if word not in matched_words]

    return matches, unmatched_words

def parseDateTime(input_text):
    # Process input text with SpaCy
    doc = nlp(input_text)
    
    # Initialize default values
    event_date = datetime.now()  # Default to today if no date found
    event_time = []  # Default to None if no time found, indicating all-day event

    # Extract date and time entities
    for ent in doc.ents:
        if ent.label_ == "DATE":
            parsed_date = dateparser.parse(ent.text.strip("next"))
            if "next" in ent.text:
                parsed_date = parsed_date + timedelta(weeks=1)
            
            if parsed_date:
                event_date = parsed_date
        elif ent.label_ == "TIME":
            # Standardize time expressions
            if "noon" in ent.text.lower():
                event_time = (dateparser.parse("12:00"), dateparser.parse("13:00"))
            elif "midnight" in ent.text.lower():
                event_time = (dateparser.parse("00:00"), dateparser.parse("01:00"))
            elif "morning" in ent.text.lower():
                event_time = (dateparser.parse("09:00"), dateparser.parse("10:00"))  # Assuming morning as 9 AM
            elif "afternoon" in ent.text.lower():
                event_time = (dateparser.parse("15:00"), dateparser.parse("16:00"))  # Assuming afternoon as 12 PM
            elif "evening" in ent.text.lower():
                event_time = (dateparser.parse("18:00"), dateparser.parse("19:00"))  # Assuming evening as 6 PM
            elif "night" in ent.text.lower():
                event_time = (dateparser.parse("21:00"), dateparser.parse("22:00"))  # Assuming night as 9 PM
            else:
                if "to" in ent.text:
                    text = ent.text.split(" to ")

                    for c in text:
                        event_time.append(dateparser.parse(c))

                    event_time = tuple(event_time)
                else:
                    parsed_time = dateparser.parse(ent.text)
                    event_time = (parsed_time, (parsed_time + timedelta(hours=1)))

    if event_time == []:
        event_time = (dateparser.parse("00:00"), dateparser.parse("23:59"))

    startDateTime = datetime.combine(event_date, event_time[0].time()).isoformat()
    endDateTime = datetime.combine(event_date, event_time[1].time()).isoformat()

    return startDateTime, endDateTime