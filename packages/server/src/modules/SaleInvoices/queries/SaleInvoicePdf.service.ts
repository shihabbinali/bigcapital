import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { renderInvoicePaperTemplateHtml } from '@bigcapital/pdf-templates';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetSaleInvoice } from './GetSaleInvoice.service';
import { transformInvoiceToPdfTemplate } from '../utils';
import { SaleInvoicePdfTemplate } from './SaleInvoicePdfTemplate.service';
import { ChromiumlyTenancy } from '@/modules/ChromiumlyTenancy/ChromiumlyTenancy.service';
import { SaleInvoice } from '../models/SaleInvoice';
import { PdfTemplateModel } from '@/modules/PdfTemplate/models/PdfTemplate';
import { events } from '@/common/events/events';
import { InvoicePdfTemplateAttributes } from '../SaleInvoice.types';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class SaleInvoicePdf {
  constructor(
    private chromiumlyTenancy: ChromiumlyTenancy,
    private getInvoiceService: GetSaleInvoice,
    private invoiceBrandingTemplateService: SaleInvoicePdfTemplate,
    private eventPublisher: EventEmitter2,

    @Inject(SaleInvoice.name)
    private saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,

    @Inject(PdfTemplateModel.name)
    private pdfTemplateModel: TenantModelProxy<typeof PdfTemplateModel>,
  ) {}

  /**
   * Retrieve sale invoice html content.
   * @param {ISaleInvoice} saleInvoice -
   * @returns {Promise<string>}
   */
  public async getSaleInvoiceHtml(invoiceId: number): Promise<string> {
    const brandingAttributes =
      await this.getInvoiceBrandingAttributes(invoiceId);

    return renderInvoicePaperTemplateHtml({
      ...brandingAttributes,
    });
  }

  /**
   * Retrieve sale invoice pdf content.
   * @param {ISaleInvoice} saleInvoice -
   * @returns {Promise<[Buffer, string]>}
   */
  public async getSaleInvoicePdf(invoiceId: number): Promise<[Buffer, string]> {
    const filename = await this.getInvoicePdfFilename(invoiceId);
    const htmlContent = await this.getSaleInvoiceHtml(invoiceId);

    // Converts the given html content to pdf document.
    const buffer = await this.chromiumlyTenancy.convertHtmlContent(htmlContent);
    const eventPayload = { saleInvoiceId: invoiceId };

    // Triggers the `onSaleInvoicePdfViewed` event.
    await this.eventPublisher.emitAsync(
      events.saleInvoice.onPdfViewed,
      eventPayload,
    );
    return [buffer, filename];
  }

  /**
   * Retrieves the filename pdf document of the given invoice.
   * @param {number} invoiceId
   * @returns {Promise<string>}
   */
  private async getInvoicePdfFilename(invoiceId: number): Promise<string> {
    const invoice = await this.saleInvoiceModel().query().findById(invoiceId);
    return `Invoice-${invoice.invoiceNo}`;
  }

  /**
   * Retrieves the branding attributes of the given sale invoice.
   * @param {number} invoiceId
   * @returns {Promise<InvoicePdfTemplateAttributes>}
   */
  private async getInvoiceBrandingAttributes(
    invoiceId: number,
  ): Promise<InvoicePdfTemplateAttributes> {
    const invoice = await this.getInvoiceService.getSaleInvoice(invoiceId);

    // Retrieve the invoice template id or get the default template id if not found.
    const templateId =
      invoice.pdfTemplateId ??
      (
        await this.pdfTemplateModel().query().findOne({
          resource: 'SaleInvoice',
          default: true,
        })
      )?.id;

    // Get the branding template attributes.
    const brandingTemplate =
      await this.invoiceBrandingTemplateService.getInvoicePdfTemplate(
        templateId,
      );

    // Merge the branding template attributes with the invoice.
    const attributes = {
      ...brandingTemplate.attributes,
      ...transformInvoiceToPdfTemplate(invoice),
    } as InvoicePdfTemplateAttributes;

    // Fetch the company logo and embed it as a data URI so that Gotenberg's
    // Chromium does not need to make an external network call (which would
    // fail when Gotenberg runs in Docker and the URL points to localhost).
    if (attributes.companyLogo) {
      try {
        const response = await axios.get(attributes.companyLogo, {
          responseType: 'arraybuffer',
        });
        const base64 = Buffer.from(response.data).toString('base64');
        const mimeType = response.headers['content-type'] || 'image/png';
        attributes.companyLogo = `data:${mimeType};base64,${base64}`;
      } catch {
        // If the logo fetch fails, leave the original URL in place.
        // The template conditionally renders the logo only when the URI is set,
        // so a failed fetch effectively hides it — acceptable fallback.
      }
    }
    return attributes;
  }
}
