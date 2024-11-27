import subprocess

subprocess.run("wsl bash -c \"cd ~/Projects/LunaAI && source .venv/bin/activate && cd models && python3.10 -m piper.http_server --model en_US-hfc_female-medium.onnx\"", shell=True)
subprocess.run("wsl --shutdown", shell=True)
