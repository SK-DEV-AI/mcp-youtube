#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawnPromise } from "spawn-rx";
import { rimraf } from "rimraf";

const server = new Server(
  {
    name: "mcp-youtube",
    version: "0.7.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_video_info",
        description:
          "Get comprehensive information about a YouTube video including metadata, available formats, and subtitle options. This helps understand what content is available before downloading.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL of the YouTube video" },
          },
          required: ["url"],
        },
      },
      {
        name: "list_available_subtitles",
        description:
          "List all available subtitle tracks for a YouTube video, including manual and auto-generated subtitles in different languages.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL of the YouTube video" },
          },
          required: ["url"],
        },
      },
      {
        name: "download_subtitles",
        description:
          "Download subtitles from a YouTube video with comprehensive options for language, format, and time range selection. Perfect for long videos where you only need subtitles for a specific portion.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL of the YouTube video" },
            languages: {
              type: "array",
              items: { type: "string" },
              description: "Subtitle languages to download (e.g., ['en', 'es', 'fr']). Use 'all' for all available languages.",
              default: ["en"]
            },
            formats: {
              type: "array",
              items: { type: "string" },
              description: "Subtitle formats to download (e.g., ['vtt', 'srt', 'ass'])",
              default: ["vtt"]
            },
            subtitle_types: {
              type: "array",
              items: { type: "string" },
              description: "Types of subtitles to download: 'manual' (human-created), 'auto' (auto-generated), 'live_chat'",
              default: ["manual", "auto"]
            },
            time_start: {
              type: "string",
              description: "Start time for subtitle download (format: 'HH:MM:SS' or 'MM:SS'). If not specified, downloads from beginning."
            },
            time_end: {
              type: "string",
              description: "End time for subtitle download (format: 'HH:MM:SS' or 'MM:SS'). If not specified, downloads until end."
            },
            include_metadata: {
              type: "boolean",
              description: "Whether to include video metadata (title, duration, description) in the response",
              default: true
            },
          },
          required: ["url"],
        },
      },
      {
        name: "download_video_metadata",
        description:
          "Download comprehensive metadata for a YouTube video including title, description, duration, upload date, and available formats.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL of the YouTube video" },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Helper function to parse time string to seconds
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  throw new Error(`Invalid time format: ${timeStr}. Use MM:SS or HH:MM:SS`);
}

// Helper function to format seconds to time string
function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function handleGetVideoInfo(args: { url: string }) {
  const { url } = args;
  const tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}youtube-`);

  try {
    // Check if yt-dlp is available
    try {
      await spawnPromise("yt-dlp", ["--version"], { cwd: tempDir });
    } catch (err) {
      throw new Error("yt-dlp is not installed. Please install yt-dlp first.");
    }

    // Get video info without downloading
    const result = await spawnPromise(
      "yt-dlp",
      [
        "--dump-json",
        "--no-download",
        "--skip-download",
        "--no-warnings",
        url,
      ],
      { cwd: tempDir }
    );

    // Extract JSON from output (yt-dlp might include warnings)
    let jsonText = result.trim();
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    const videoInfo = JSON.parse(jsonText);

    const info = {
      title: videoInfo.title || "Unknown Title",
      duration: videoInfo.duration ? formatSecondsToTime(videoInfo.duration) : "Unknown",
      uploader: videoInfo.uploader || "Unknown",
      upload_date: videoInfo.upload_date || "Unknown",
      view_count: videoInfo.view_count || 0,
      description: videoInfo.description || "",
      formats: videoInfo.formats?.length || 0,
      subtitles_available: Object.keys(videoInfo.subtitles || {}).length,
      auto_subtitles_available: Object.keys(videoInfo.automatic_captions || {}).length,
    };

    return {
      content: [
        {
          type: "text",
          text: `Video Information:\n` +
                `Title: ${info.title}\n` +
                `Duration: ${info.duration}\n` +
                `Uploader: ${info.uploader}\n` +
                `Upload Date: ${info.upload_date}\n` +
                `Views: ${info.view_count.toLocaleString()}\n` +
                `Available Formats: ${info.formats}\n` +
                `Manual Subtitles: ${info.subtitles_available} languages\n` +
                `Auto Subtitles: ${info.auto_subtitles_available} languages\n\n` +
                `Description:\n${info.description.substring(0, 500)}${info.description.length > 500 ? '...' : ''}`,
        },
      ],
    };
  } finally {
    rimraf.sync(tempDir);
  }
}

async function handleListAvailableSubtitles(args: { url: string }) {
  const { url } = args;
  const tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}youtube-`);

  try {
    // Check if yt-dlp is available
    try {
      await spawnPromise("yt-dlp", ["--version", "--no-warnings"], { cwd: tempDir });
    } catch (err) {
      throw new Error("yt-dlp is not installed. Please install yt-dlp first.");
    }

    // List available subtitles
    const result = await spawnPromise(
      "yt-dlp",
      [
        "--list-subs",
        "--no-download",
        "--no-warnings",
        url,
      ],
      { cwd: tempDir }
    );

    return {
      content: [
        {
          type: "text",
          text: `Available Subtitles:\n${result}`,
        },
      ],
    };
  } finally {
    rimraf.sync(tempDir);
  }
}

async function handleDownloadSubtitles(args: {
  url: string;
  languages?: string[];
  formats?: string[];
  subtitle_types?: string[];
  time_start?: string;
  time_end?: string;
  include_metadata?: boolean;
}) {
  const {
    url,
    languages = ["en"],
    formats = ["vtt"],
    subtitle_types = ["manual", "auto"],
    time_start,
    time_end,
    include_metadata = true
  } = args;

  const tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}youtube-`);

  try {
    // Build yt-dlp arguments
    const ytDlpArgs = ["--skip-download"];

    // Add subtitle type options
    if (subtitle_types.includes("manual")) {
      ytDlpArgs.push("--write-subs");
    }
    if (subtitle_types.includes("auto")) {
      ytDlpArgs.push("--write-auto-subs");
    }
    if (subtitle_types.includes("live_chat")) {
      ytDlpArgs.push("--write-subs");
      languages.push("live_chat");
    }

    // Set languages
    if (languages.includes("all")) {
      ytDlpArgs.push("--sub-langs", "all");
    } else {
      ytDlpArgs.push("--sub-langs", languages.join(","));
    }

    // Set formats
    if (formats.length === 1) {
      ytDlpArgs.push("--sub-format", formats[0]);
    } else {
      // For multiple formats, we'll need to download and convert
      ytDlpArgs.push("--sub-format", "vtt");
    }

    // Add time range if specified
    if (time_start || time_end) {
      const startSeconds = time_start ? parseTimeToSeconds(time_start) : 0;
      const endSeconds = time_end ? parseTimeToSeconds(time_end) : undefined;

      if (endSeconds && startSeconds >= endSeconds) {
        throw new Error("Start time must be before end time");
      }

      ytDlpArgs.push("--download-sections", `*${startSeconds}-${endSeconds || "inf"}`);
    }

    ytDlpArgs.push(url);

    // Download subtitles
    await spawnPromise("yt-dlp", ytDlpArgs, { cwd: tempDir });

    let content = "";
    let metadata = "";

    // Get video metadata if requested
    if (include_metadata) {
      try {
        const metadataResult = await spawnPromise(
          "yt-dlp",
          ["--dump-json", "--no-download", "--no-warnings", url],
          { cwd: tempDir }
        );

        // Extract JSON from output (yt-dlp might include warnings)
        let metadataJsonText = metadataResult.trim();
        const firstBrace = metadataJsonText.indexOf('{');
        const lastBrace = metadataJsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          metadataJsonText = metadataJsonText.substring(firstBrace, lastBrace + 1);
        }

        const videoInfo = JSON.parse(metadataJsonText);
        metadata = `Video: ${videoInfo.title}\n` +
                  `Duration: ${formatSecondsToTime(videoInfo.duration || 0)}\n` +
                  `Time Range: ${time_start || "0:00"} - ${time_end || formatSecondsToTime(videoInfo.duration || 0)}\n\n`;
      } catch (err) {
        metadata = `Could not retrieve video metadata: ${err}\n\n`;
      }
    }

    // Process downloaded subtitle files
    const files = fs.readdirSync(tempDir);
    const subtitleFiles = files.filter(file => file.endsWith('.vtt') || file.endsWith('.srt'));

    if (subtitleFiles.length === 0) {
      content = "No subtitles were downloaded. They may not be available for this video.";
    } else {
      for (const file of subtitleFiles) {
        const fileContent = fs.readFileSync(path.join(tempDir, file), "utf8");

        // For multiple formats, convert if needed
        if (formats.length > 1 && formats[0] !== "vtt") {
          // Use the original stripVttNonContent for VTT files
          const cleanedContent = stripVttNonContent(fileContent);
          content += `${file} (converted to text)\n====================\n${cleanedContent}\n\n`;
        } else {
          // For single format, preserve more structure
          const cleanedContent = stripVttNonContent(fileContent);
          content += `${file}\n====================\n${cleanedContent}\n\n`;
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `${metadata}Downloaded Subtitles:\n${content}`,
        },
      ],
    };
  } finally {
    rimraf.sync(tempDir);
  }
}

async function handleDownloadVideoMetadata(args: { url: string }) {
  const { url } = args;
  const tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}youtube-`);

  try {
    // Check if yt-dlp is available
    try {
      await spawnPromise("yt-dlp", ["--version", "--no-warnings"], { cwd: tempDir });
    } catch (err) {
      throw new Error("yt-dlp is not installed. Please install yt-dlp first.");
    }

    const result = await spawnPromise(
      "yt-dlp",
      [
        "--dump-json",
        "--no-download",
        "--no-warnings",
        url,
      ],
      { cwd: tempDir }
    );

    // Extract JSON from output (yt-dlp might include warnings)
    let jsonText = result.trim();
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    const videoInfo = JSON.parse(jsonText);

    const metadata = {
      title: videoInfo.title || "Unknown",
      description: videoInfo.description || "",
      duration: videoInfo.duration ? formatSecondsToTime(videoInfo.duration) : "Unknown",
      uploader: videoInfo.uploader || "Unknown",
      upload_date: videoInfo.upload_date || "Unknown",
      view_count: videoInfo.view_count || 0,
      like_count: videoInfo.like_count || 0,
      channel_url: videoInfo.channel_url || "",
      thumbnail: videoInfo.thumbnail || "",
      formats: videoInfo.formats?.map((f: any) => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution || "audio only",
        filesize: f.filesize,
        tbr: f.tbr,
      })) || [],
      subtitles: Object.keys(videoInfo.subtitles || {}),
      auto_subtitles: Object.keys(videoInfo.automatic_captions || {}),
    };

    return {
      content: [
        {
          type: "text",
          text: `Video Metadata:\n` +
                `Title: ${metadata.title}\n` +
                `Duration: ${metadata.duration}\n` +
                `Uploader: ${metadata.uploader}\n` +
                `Upload Date: ${metadata.upload_date}\n` +
                `Views: ${metadata.view_count.toLocaleString()}\n` +
                `Likes: ${metadata.like_count.toLocaleString()}\n` +
                `Channel URL: ${metadata.channel_url}\n` +
                `Thumbnail: ${metadata.thumbnail}\n` +
                `Available Formats: ${metadata.formats.length}\n` +
                `Manual Subtitles: ${metadata.subtitles.join(", ") || "None"}\n` +
                `Auto Subtitles: ${metadata.auto_subtitles.join(", ") || "None"}\n\n` +
                `Description:\n${metadata.description}`,
        },
      ],
    };
  } finally {
    rimraf.sync(tempDir);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  try {
    switch (name) {
      case "get_video_info":
        return await handleGetVideoInfo(request.params.arguments as { url: string });
      case "list_available_subtitles":
        return await handleListAvailableSubtitles(request.params.arguments as { url: string });
      case "download_subtitles":
        return await handleDownloadSubtitles(request.params.arguments as {
          url: string;
          languages?: string[];
          formats?: string[];
          subtitle_types?: string[];
          time_start?: string;
          time_end?: string;
          include_metadata?: boolean;
        });
      case "download_video_metadata":
        return await handleDownloadVideoMetadata(request.params.arguments as { url: string });
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    console.error(`Error in tool ${name}:`, err);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Strips non-content elements from VTT subtitle files with optional timing preservation
 */
export function stripVttNonContent(vttContent: string, preserveTiming: boolean = false): string {
  if (!vttContent || vttContent.trim() === "") {
    return "";
  }

  // Check if it has at least a basic VTT structure
  const lines = vttContent.split("\n");
  if (lines.length < 2 || !lines[0].includes("WEBVTT")) {
    return "";
  }

  // Skip the header lines (WEBVTT, Kind, Language, empty line)
  let contentLines = lines.slice(1);
  let headerEndIndex = 1;

  // Find where the actual content starts
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "" && i + 1 < lines.length && lines[i + 1].includes("-->")) {
      headerEndIndex = i + 1;
      break;
    }
  }
  contentLines = lines.slice(headerEndIndex);

  if (preserveTiming) {
    // Preserve timing information but clean up formatting
    const processedLines: string[] = [];

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];

      if (line.includes("-->")) {
        // This is a timing line, clean it up
        const timingMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (timingMatch) {
          processedLines.push(`${timingMatch[1]} --> ${timingMatch[2]}`);
        }
      } else if (line.trim() !== "" && !line.includes("align:") && !line.includes("position:")) {
        // This is content, clean up tags but keep the text
        const cleanedLine = line
          .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>|<\/c>/g, "")
          .replace(/<c>/g, "")
          .trim();

        if (cleanedLine !== "") {
          processedLines.push(cleanedLine);
        }
      }
    }

    return processedLines.join("\n");
  } else {
    // Original behavior - strip all timing and formatting
    const textLines: string[] = [];

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];

      // Skip timestamp lines (containing --> format)
      if (line.includes("-->")) continue;

      // Skip positioning metadata lines
      if (line.includes("align:") || line.includes("position:")) continue;

      // Skip empty lines
      if (line.trim() === "") continue;

      // Clean up the line by removing timestamp tags like <00:00:07.759>
      const cleanedLine = line
        .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>|<\/c>/g, "")
        .replace(/<c>/g, "");

      if (cleanedLine.trim() !== "") {
        textLines.push(cleanedLine.trim());
      }
    }

    // Remove duplicate adjacent lines
    const uniqueLines: string[] = [];
    for (let i = 0; i < textLines.length; i++) {
      if (i === 0 || textLines[i] !== textLines[i - 1]) {
        uniqueLines.push(textLines[i]);
      }
    }

    return uniqueLines.join("\n");
  }
}

async function runServer() {
  console.error("Starting YouTube MCP Server v0.7.0...");

  // Validate yt-dlp availability on startup
  try {
    await spawnPromise("yt-dlp", ["--version", "--no-warnings"]);
    console.error("✓ yt-dlp is available");
  } catch (err) {
    console.error("✗ yt-dlp is not installed. Please install yt-dlp and try again.");
    console.error("Installation: pip install yt-dlp");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✓ YouTube MCP Server started successfully");
}

runServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
