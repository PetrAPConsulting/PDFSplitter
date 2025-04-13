// split_pdf.js (CommonJS - adding integrated rename function)
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises; // Use promise-based fs
const path = require('path');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);

// --- Configuration ---
const outputDir = process.cwd();
const pdftocairoPath = '/usr/local/bin/pdftocairo'; // Assumes Intel Mac Homebrew default
// --- End Configuration ---

// --- Renaming Function ---
async function renameSuffixedFiles(directory = '.') {
    console.log('\nStarting thumbnail rename process...');
    // Regex to match 'page_N_basename-N(N).ext'
    // Group 1: page_N_basename (e.g., page_1_Prompting_Science_Report_1)
    // Group 2: N(N) (suffix digits - now matching one or more digits for flexibility)
    // Group 3: .ext (extension, e.g., .jpeg)
    const pattern = /^(page_\d+_.*?)-(\d+)(\.[^.]+)$/i; // Added 'i' for case-insensitivity, (\d+) for flexible digits
    let renamed_count = 0;
    let skipped_count = 0;
    let error_count = 0;
    let files = []; // Initialize files array

    try {
        // Get directory entries with file types
        const dirents = await fs.readdir(directory, { withFileTypes: true });
        // Filter for files only and get their names
        files = dirents.filter(dirent => dirent.isFile()).map(dirent => dirent.name);
        console.log(`Processing ${files.length} files found in directory.`);

        for (const filename of files) {
            const match = filename.match(pattern);

            // Check if the filename matches the pattern
            if (match) {
                const base_name = match[1]; // The part before the suffix
                const extension = match[3]; // The file extension
                const new_filename = `${base_name}${extension}`; // The desired new filename

                const old_path = path.join(directory, filename);
                const new_path = path.join(directory, new_filename);

                // Skip if old and new names are somehow the same
                if (old_path === new_path) {
                    continue;
                }

                try {
                    // Check if the target filename already exists
                    await fs.access(new_path);
                    // If fs.access succeeds without error, the file exists.
                    console.log(`SKIPPED: Cannot rename '${filename}' to '${new_filename}' - target file already exists.`);
                    skipped_count++;

                } catch (accessError) {
                    // If fs.access throws ENOENT error, the target file does NOT exist - proceed with rename
                    if (accessError.code === 'ENOENT') {
                        try {
                            await fs.rename(old_path, new_path);
                            console.log(`Renamed: '${filename}' → '${new_filename}'`);
                            renamed_count++;
                        } catch (renameError) {
                            console.error(`ERROR: Failed to rename '${filename}': ${renameError.message}`);
                            error_count++;
                        }
                    } else {
                        // Different error occurred trying to check the new path
                        console.error(`ERROR: Checking target path '${new_path}' failed: ${accessError.message}`);
                        error_count++;
                    }
                }
            } else {
                // File didn't match the pattern, implicitly skipped for renaming
            }
        }
    } catch (err) {
        console.error(`ERROR: Failed during rename process (e.g., reading directory): ${err.message}`);
        // Can't reliably count skips if directory read fails early
    }

    console.log(`\nRename operation complete.`);
    console.log(`Files renamed: ${renamed_count}`);
    // Calculate skipped count more accurately
    skipped_count = files.length - renamed_count - error_count;
    console.log(`Files skipped (no match / target existed): ${skipped_count}`);
    console.log(`Errors during rename: ${error_count}`);
}
// --- END Renaming Function ---


// --- Main PDF Processing Function ---
async function splitPdfAndCreateThumbnails(pdfPath) {
    try {
        console.log(`Processing file: ${pdfPath}`);

        const absolutePdfPath = path.resolve(pdfPath);
        // Input file and pdftocairo checks...
        try { await fs.access(absolutePdfPath); } catch (err) { console.error(`Error: Input file not found at ${absolutePdfPath}`); process.exit(1); }
        try { await fs.access(pdftocairoPath); } catch (err) { console.error(`Error: pdftocairo not found at ${pdftocairoPath}. Ensure Poppler is installed via Homebrew.`); process.exit(1); }

        const baseName = path.basename(pdfPath, path.extname(pdfPath));
        const pdfBytes = await fs.readFile(absolutePdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();

        console.log(`Found ${pageCount} pages. Starting splitting...`);

        // --- 1. Split PDF ---
        for (let i = 0; i < pageCount; i++) {
            const pageNum = i + 1;
            const outputPdfPath = path.join(outputDir, `page_${pageNum}_${baseName}.pdf`);
            console.log(` -> Creating ${path.basename(outputPdfPath)}...`);
            const subDoc = await PDFDocument.create();
            const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
            subDoc.addPage(copiedPage);
            const subDocBytes = await subDoc.save();
            await fs.writeFile(outputPdfPath, subDocBytes);
        }
        console.log('PDF splitting complete.');

        // --- 2. Generate JPEG thumbnails ---
        console.log(`Starting thumbnail generation using ${pdftocairoPath}...`);
        for (let i = 1; i <= pageCount; i++) {
            const pageNum = i;
            const outputPrefix = path.join(outputDir, `page_${pageNum}_${baseName}`);
            console.log(` -> Processing thumbnail for page ${pageNum}...`);
            console.log(`    Output prefix for pdftocairo: ${outputPrefix}`);
            const args = ['-jpeg', '-f', pageNum.toString(), '-l', pageNum.toString(), absolutePdfPath, outputPrefix];
            try {
                console.log(`    Executing: ${pdftocairoPath} ${args.join(' ')}`);
                const { stdout, stderr } = await execFile(pdftocairoPath, args);
                if (stderr) { console.warn(`    Warning/Stderr from pdftocairo for page ${pageNum}:`, stderr); }
                console.log(`    pdftocairo command executed for page ${pageNum}.`);
            } catch (error) {
                console.error(`    ERROR generating thumbnail for page ${pageNum}:`);
                console.error(`      Exit code: ${error.code}`);
                console.error(`      Stderr: ${error.stderr}`);
            }
        }
        console.log('Thumbnail generation processing finished.');

        // --- Call the renaming function AFTER thumbnails are done ---
        await renameSuffixedFiles(outputDir);
        // --- End call ---

        console.log('\nScript finished successfully!');

    } catch (error) {
        console.error('\nAn unexpected error occurred during the main processing:');
        console.error(error);
        process.exit(1);
    }
}
// --- End Main PDF Processing Function ---


// --- Script Execution ---
const args = process.argv.slice(2);
if (args.length !== 1) { console.error('Usage: node split_pdf.js <input_pdf_file>'); process.exit(1); }
const inputFile = args[0];
if (path.extname(inputFile).toLowerCase() !== '.pdf') { console.error('Error: Input file must be a .pdf file.'); process.exit(1); }

splitPdfAndCreateThumbnails(inputFile)
    .catch(error => {
        console.error('\nAn unhandled error occurred at the top level:', error);
        process.exit(1);
    });
