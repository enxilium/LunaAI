import React, { useEffect, useRef } from "react";

interface AudioOrbProps {
  color: string;
}

const AudioOrb: React.FC<AudioOrbProps> = ({ color }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let audioCtx: AudioContext | null = null;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      if (!canvas || !ctx) return;

      canvas.width = 300;
      canvas.height = 300;

      const drawCircle = (
        x: number,
        y: number,
        radius: number,
        fillStyle: string,
        shadowBlur: number = 10,
        shadowColor: string = fillStyle
      ) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColor;
        ctx.fill();
      };

      const draw = () => {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        const lowFreqs = dataArray.slice(0, 25);
        const highFreqs = dataArray.slice(25, 60);

        const avgHigh = highFreqs.reduce((a, b) => a + b, 0) / bufferLength;
        const pulseHigh = avgHigh / 25;

        const avgLow = lowFreqs.reduce((a, b) => a + b, 0) / bufferLength;
        const pulseLow = avgLow / 25;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawCircle(150, 150 + pulseLow * 30, 20 + pulseLow * 5, color);
        drawCircle(150 + pulseLow * 20, 150 + pulseLow * 20, 5 + pulseLow * 20, color);
        drawCircle(150 - pulseLow * 20, 150 + pulseLow * 20, 5 + pulseLow * 20, color);

        drawCircle(150, 150 - pulseHigh * 20, 20 + pulseHigh * 5, color);
        drawCircle(150 - pulseHigh * 20, 150 - pulseHigh * 10, 5 + pulseHigh * 10, color);
        drawCircle(150 + pulseHigh * 20, 150 - pulseHigh * 10, 5 + pulseHigh * 10, color);

        drawCircle(150, 150, 40 + pulseLow * 10, color, 20 + pulseLow * 10);
        drawCircle(150, 150, 20 + pulseHigh * 15, "rgba(200, 120, 255,0.5)", 10, "white");
      };

      draw();
    });

    return () => {
      if (audioCtx) audioCtx.close();
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    />
  );
};

export default AudioOrb;
