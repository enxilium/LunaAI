from googleapiclient.discovery import build
import subprocess
import os
import json
from pathlib import Path
import win32com.client  # Requires `pywin32` package for reading `.lnk` files

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
    start_menu_paths = [
        Path("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
        Path.home() / "AppData/Roaming/Microsoft/Windows/Start Menu/Programs"
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