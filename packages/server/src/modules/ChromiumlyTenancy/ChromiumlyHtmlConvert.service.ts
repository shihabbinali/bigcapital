import { Injectable } from '@nestjs/common';
import * as FormData from 'form-data';
import { PageProperties, PdfFormat } from '@/libs/chromiumly/_types';
import { Chromiumly } from '@/libs/chromiumly/Chromiumly';
import { GotenbergUtils } from '@/libs/chromiumly/GotenbergUtils';
import { ConverterUtils } from '@/libs/chromiumly/ConvertUtils';

@Injectable()
export class ChromiumlyHtmlConvert {
  /**
   * Converts the given HTML content to PDF.
   * Sends the HTML string directly to Gotenberg's /html endpoint
   * instead of writing a temp file and having Gotenberg fetch a URL.
   * @param {string} html
   * @param {PageProperties} properties
   * @param {PdfFormat} pdfFormat
   * @returns {Promise<Buffer>}
   */
  async convert(
    html: string,
    properties?: PageProperties,
    pdfFormat?: PdfFormat,
  ): Promise<Buffer> {
    const endpoint = `${Chromiumly.GOTENBERG_ENDPOINT}/${Chromiumly.CHROMIUM_PATH}/html`;
    const data = new FormData();

    data.append('index.html', Buffer.from(html), {
      filename: 'index.html',
      contentType: 'text/html',
    });

    if (pdfFormat) {
      data.append('pdfFormat', pdfFormat);
    }
    if (properties) {
      ConverterUtils.injectPageProperties(data, properties);
    }
    return GotenbergUtils.fetch(endpoint, data);
  }
}
