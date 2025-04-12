# PDF Splitter
A simple Node.js script to split a PDF into individual pages and create JPEG thumbnails. Split PDF to individual pages with inherited file name. In some business cases is beneficial to use chunking strategy based on individual pages especially for semantic search when the goal is to show specific page rather than compile response to user request. PDF Splitter is right tool for initial PDF processing. After splitting you can use another my tool for text and image extraction, MistralOCR.

## Prerequisites

* **Node.js & npm:** Must be installed on your system.
* **Homebrew:** Required for installing Poppler on macOS.
* **Poppler:** The script uses the `pdftocairo` command-line tool. Install via Homebrew:
    ```bash
    brew install poppler
    ```
* **Node.js Dependencies:** The script uses `pdf-lib`.

## Setup

1.  Save the script (e.g., `split_pdf.js`) in a folder.
2.  Place the PDF you want to process in the same folder.
3.  Open your terminal and navigate (`cd`) into that folder.
4.  Install the necessary Node.js package:
    ```bash
    npm install pdf-lib
    ```
    *(If you have a `package.json` file, just run `npm install`)*

## How to Run

Execute the script using Node.js, providing the name of your PDF file as a command-line argument:

```bash
node split_pdf.js your_file_name.pdf
