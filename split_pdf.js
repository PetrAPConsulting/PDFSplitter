// split_pdf.js (CommonJS - using child_process - creates suffixed JPEGs)
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);

// --- Configuration ---
const outputDir = process.cwd();
// Define path to system's pdftocairo (Intel Mac Homebrew default)
const pdftocairoPath = '/usr/local/bin/pdftocairo';
// --- End Configuration ---

async function splitPdfAndCreateThumbnails(pdfPath) {
    try {
        console.log(`Processing file: ${pdfPath}`);

        const absolutePdfPath = path.resolve(pdfPath);
        try {
            await fs.access(absolutePdfPath);
        } catch (err) {
            console.error(`Error: Input file not found at ${absolutePdfPath}`);
            process.exit(1);
        }

        // Check if pdftocairo executable exists
        try {
            await fs.access(pdftocairoPath);
        } catch (err) {
            console.error(`Error: pdftocairo not found at ${pdftocairoPath}.`);
            console.error('Please ensure Poppler is installed via Homebrew (`brew install poppler`).');
            process.exit(1);
        }


        const baseName = path.basename(pdfPath, path.extname(pdfPath));
        const pdfBytes = await fs.readFile(absolutePdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();

        console.log(`Found ${pageCount} pages. Starting splitting...`);

        // --- 1. Split PDF into individual pages ---
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

        // --- 2. Generate JPEG thumbnails using system pdftocairo ---
        console.log(`Starting thumbnail generation using ${pdftocairoPath}...`);

        for (let i = 1; i <= pageCount; i++) {
            const pageNum = i;
            // Define the output *prefix* passed to pdftocairo
            const outputPrefix = path.join(outputDir, `page_${pageNum}_${baseName}`);

            console.log(` -> Processing thumbnail for page ${pageNum}...`);
            console.log(`    Output prefix: ${outputPrefix}`);

            // Arguments for pdftocairo command:
            const args = [
                '-jpeg',                // Output format JPEG
                '-f', pageNum.toString(), // First page (needs to be string)
                '-l', pageNum.toString(), // Last page (needs to be string)
                // '-scale-to', '150',  // Optional: uncomment and set size if needed
                absolutePdfPath,        // Input PDF file path
                outputPrefix            // Output prefix (pdftocairo adds .jpeg and maybe suffix)
            ];

            try {
                console.log(`    Executing: ${pdftocairoPath} ${args.join(' ')}`);
                const { stdout, stderr } = await execFile(pdftocairoPath, args);

                if (stderr) {
                    console.warn(`    Warning/Stderr from pdftocairo for page ${pageNum}:`, stderr);
                }
                console.log(`    pdftocairo command executed for page ${pageNum}.`);

                // Basic check if *some* output was likely created (user will handle suffix)
                console.log(`    Check for output file near: ${outputPrefix}.jpeg`);


            } catch (error) {
                // execFile throws an error if the command fails (non-zero exit code)
                console.error(`    ERROR generating thumbnail for page ${pageNum}:`);
                console.error(`      Exit code: ${error.code}`);
                console.error(`      Stderr: ${error.stderr}`);
                console.error(`      Stdout: ${error.stdout}`);
                // Continue to the next page if one fails
            }
        }
        console.log('Thumbnail generation processing finished.');
        console.log('\nScript finished successfully (JPEGs may have page number suffixes)!'); // Adjusted final message

    } catch (error) {
        console.error('\nAn unexpected error occurred during the main processing:');
        console.error(error);
        process.exit(1); // Exit with error code
    }
}

// --- Script Execution (CommonJS style) ---
const args = process.argv.slice(2);

if (args.length !== 1) {
    console.error('Usage: node split_pdf.js <input_pdf_file>');
    process.exit(1);
}

const inputFile = args[0];

if (path.extname(inputFile).toLowerCase() !== '.pdf') {
    console.error('Error: Input file must be a .pdf file.');
    process.exit(1);
}

splitPdfAndCreateThumbnails(inputFile)
    .catch(error => {
        console.error('\nAn unhandled error occurred at the top level:', error);
        process.exit(1);
    });