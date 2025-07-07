const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

// SET YOUR FFmpeg PATH HERE if needed:
//ffmpeg.setFfmpegPath(__dirname + "/ffmpeg.exe");

// Optional: Keep track of active connections
let activeStreams = 0;
const MAX_STREAMS = 5;

app.get("/stream", (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (activeStreams >= MAX_STREAMS) {
    console.log(`[${clientIp}] rejected: too many connections`);
    res.status(503).send("Server busy. Try again later.");
    return;
  }

  activeStreams++;
  console.log(`[${clientIp}] connected. Active streams: ${activeStreams}`);

  res.set({
    "Content-Type": "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Connection": "keep-alive"
  });

  // Setup FFmpeg stream
  const ffmpegProc = ffmpeg("https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio010/hlspbaudio01064kbps.m3u8")
    .addInputOption("-re")
    .format("mp3")
    .audioCodec("libmp3lame")
    .on("start", cmd => console.log(`[${clientIp}] FFmpeg started: ${cmd}`))
    .on("stderr", line => console.log(`[FFmpeg] ${line}`))
    .on("error", (err, stdout, stderr) => {
      console.error(`[${clientIp}] FFmpeg error:`, err.message);
      res.end();
    })
    .pipe(res, { end: true });

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[${clientIp}] disconnected. Closing FFmpeg.`);
    if (ffmpegProc && ffmpegProc.kill) {
      try {
        ffmpegProc.kill("SIGKILL");
      } catch (err) {
        console.error("Error killing FFmpeg:", err);
      }
    }
    activeStreams--;
    console.log(`Active streams: ${activeStreams}`);
  });

  // Optional: Timeout after 2 hours (e.g., Alexa idle)
  setTimeout(() => {
    console.log(`[${clientIp}] timeout reached, killing stream`);
    res.end(); // triggers close
  }, 2 * 60 * 60 * 1000); // 2 hours
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://${os.hostname()}:${PORT}`);
});
