from googleapiclient.discovery import build
from dotenv import load_dotenv
import os
import requests
import subprocess
import auxiliary
import wolframalpha
import pyperclip
import json


# Main loop to continuously listen with timeout
def main():
    saved_applications = [app.lower() for app in ["operagxbrowser", "Visual Studio Code", "Spotify"]]
    query = "open google chrome and visual studio code opera gx browser please"
    print(auxiliary.find_matching_phrases(query, saved_applications))

if __name__ == "__main__":
    main()