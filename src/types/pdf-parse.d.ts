declare module "pdf-parse/lib/pdf-parse.js" {
    type PdfParseResult = {
        text?: string;
    };

    export default function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
}
