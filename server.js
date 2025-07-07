const express = require("express");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static"); // Uses the precompiled FFmpeg binary

const app = express();
const PORT = process.env.PORT || 3000;

// Akashvani HLS stream (AIR Marathi)
const STREAM_URL = "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio010/hlspbaudio01064kbps.m3u8";

// Optional: limit max connections
let activeStreams = 0;
const MAX_STREAMS = 5;

app.get("/stream", (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (activeStreams >= MAX_STREAMS) {
    console.log(`[${clientIp}] rejected: too many streams`);
    return res.status(503).send("Server busy. Try again later.");
  }

  activeStreams++;
  console.log(`[${clientIp}] connected. Active streams: ${activeStreams}`);

  res.set({
    "Content-Type": "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Connection": "keep-alive"
  });

  // Spawn FFmpeg to transcode the stream to MP3
  const ffmpeg = spawn(ffmpegPath, [
    "-user_agent", "Mozilla/5.0 (compatible; AkashvaniProxy/1.0)", // mimic browser
    "-re",
    "-i", STREAM_URL,
    "-vn",
    "-acodec", "libmp3lame",
    "-f", "mp3",
    "-"
  ]);

  // Pipe audio output to the client
  ffmpeg.stdout.pipe(res);

  // Log FFmpeg stderr (very useful)
  ffmpeg.stderr.on("data", (data) => {
    console.error(`[FFmpeg stderr] ${data.toString().trim()}`);
  });

  // Handle unexpected FFmpeg exit
  ffmpeg.on("exit", (code, signal) => {
    console.warn(`[FFmpeg] exited with code=${code}, signal=${signal}`);
  });

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[${clientIp}] disconnected. Killing FFmpeg.`);
    if (ffmpeg) {
      ffmpeg.kill("SIGINT");
    }
    activeStreams--;
    console.log(`Active streams: ${activeStreams}`);
  });

  // Optional: disconnect stale clients after 2 hours
  setTimeout(() => {
    console.log(`[${clientIp}] timeout reached. Ending stream.`);
    res.end();
  }, 2 * 60 * 60 * 1000); // 2 hours
});

app.listen(PORT, () => {
  console.log(`🎧 Akashvani proxy listening at http://localhost:${PORT}/stream`);
});
