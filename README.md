# Enhanced YouTube MCP Server

A powerful MCP (Model Context Protocol) server that connects AI models with YouTube's rich content via `yt-dlp`. Features comprehensive video downloading, enhanced subtitle processing with time range selection, multiple language support, intelligent caching, and robust error handling.

## ✨ New Features (v0.8.0)

- **🚀 Video Download**: Download videos with quality selection (best, 720p, 480p, 360p)
- **🔄 Intelligent Caching**: Automatic caching of video metadata for faster responses
- **🛡️ Enhanced Error Handling**: Retry mechanisms and clear error messages
- **⚡ Progress Reporting**: Real-time feedback for long operations
- **🎯 Smart Format Selection**: Automatic fallback for unavailable formats

## Core Features

- **⏰ Time-Range Downloads**: Download specific portions of videos using customizable start/end times
- **🌍 Multi-Language Support**: Download subtitles in multiple languages simultaneously
- **📊 Video Metadata**: Get comprehensive video information including title, duration, description, and formats
- **📝 Multiple Subtitle Types**: Choose between manual subtitles, auto-generated subtitles, and live chat
- **📋 Multiple Formats**: Support for VTT, SRT, ASS, MP4, WebM, and other formats
- **🔍 Subtitle Discovery**: List all available subtitle options for any video
- **🧹 Smart Processing**: Intelligent content cleaning while preserving important information

## Available Tools

### `download_video` ⭐ *NEW*
Download YouTube videos with quality and format selection:
```typescript
download_video({
  "url": "https://www.youtube.com/watch?v=...",
  "quality": "best", // "best", "720p", "480p", "360p"
  "format": "mp4",   // "mp4", "webm", "best"
  "output_filename": "my_video", // optional custom filename
  "save_path": "./downloads" // optional directory to save video
})
```

### `get_video_info`
Get comprehensive information about a YouTube video including metadata and available subtitle options. Results are automatically cached for 24 hours.

### `list_available_subtitles`
List all available subtitle tracks for a video, showing manual and auto-generated options in different languages.

### `download_subtitles`
Download subtitles with advanced options:
- **Time Range Selection**: Specify `time_start` and `time_end` (e.g., "10:30" to "25:45")
- **Multiple Languages**: Download subtitles in several languages at once
- **Format Options**: Choose from VTT, SRT, ASS formats
- **Subtitle Types**: Select manual, auto-generated, or live chat subtitles
- **Metadata Inclusion**: Optionally include video metadata in the response

### `download_video_metadata`
Get detailed video information including title, description, duration, view count, and technical details.

## Usage Examples

### Basic subtitle download:
```
download_subtitles({
  "url": "https://www.youtube.com/watch?v=...",
  "languages": ["en"],
  "formats": ["vtt"]
})
```

### Time-range subtitle download (great for long videos):
```
download_subtitles({
  "url": "https://www.youtube.com/watch?v=...",
  "languages": ["en", "es"],
  "time_start": "10:30",
  "time_end": "25:45",
  "formats": ["vtt", "srt"]
})
```

### Get video information first:
```
get_video_info({
  "url": "https://www.youtube.com/watch?v=..."
})
```

## Installation

### Prerequisites
1. Install `yt-dlp` (Homebrew and WinGet both work great):
   ```bash
   brew install yt-dlp  # macOS
   winget install yt-dlp # Windows
   ```

### Install the MCP Server

#### Manual Installation
If you prefer to manually configure the MCP server:

1. **Install the package**:
   ```bash
   npm install -g @sri-krishna/mcp-youtube
   ```

2. **Add to your MCP configuration** (usually in `~/.mcp.json` or similar):
   ```json
   {
     "mcpServers": {
       "youtube": {
         "command": "mcp-youtube",
         "args": []
       }
     }
   }
   ```

3. **Alternative configuration for npx** (if not installed globally):
   ```json
   {
     "mcpServers": {
       "youtube": {
         "command": "npx",
         "args": ["@sri-krishna/mcp-youtube"]
       }
     }
   }
   ```

## Integration with Claude

Once installed, Claude can use this server to:
- Summarize specific portions of long YouTube videos
- Extract subtitles in multiple languages
- Get video metadata for research
- Process video content with precise time selection

Try asking Claude: "Summarize the first 15 minutes of this YouTube video and provide the transcript in both English and Spanish."


credits/cloned from : https://github.com/anaisbetts/mcp-youtube.git
