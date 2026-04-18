const { chromium } = require("playwright");
const path = require("path");

const docsDir = path.resolve(__dirname, "../../docs/Software report");

async function toPdf(name) {
    const htmlFile = path.join(docsDir, name + ".html");
    const pdfFile = path.join(docsDir, name + ".pdf");

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1600, height: 2263 });
    await page.goto("file:///" + htmlFile.split(path.sep).join("/"), { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.pdf({
        path: pdfFile,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        scale: 1,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await browser.close();
    const fs = require("fs");
    const size = (fs.statSync(pdfFile).size / 1024 / 1024).toFixed(1);
    console.log(name + ".pdf (" + size + " MB)");
}

(async () => {
    await toPdf("AirTrainr_Web_Software_Report");
    await toPdf("AirTrainr_Mobile_Software_Report");
    console.log("Done!");
})();
