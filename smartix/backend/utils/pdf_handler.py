"""PDF handling utilities for Smartix Store"""
import pathlib
import uuid
import os
import shutil
import logging
import psutil
from datetime import datetime, timezone
import json
import base64

logger = logging.getLogger(__name__)

# ============= CONFIGURATION =============
MAX_PDF_PAGES = 200
MAX_PREVIEW_PAGES = 20
MIN_DISK_FREE_MB = 500
CONVERSION_TIMEOUT_SEC = 30

def check_disk_space():
    """Check if there is enough disk space available"""
    usage = psutil.disk_usage('/home/runner/workspace')
    free_mb = usage.free / (1024 * 1024)
    return free_mb > MIN_DISK_FREE_MB

def cleanup_product_files(product: dict):
    """Delete all files associated with a product"""
    try:
        paths_to_delete = []
        if product.get("pdf_file"):
            paths_to_delete.append(product["pdf_file"].lstrip("/"))
        if product.get("cover_image"):
            paths_to_delete.append(product["cover_image"].lstrip("/"))
        if product.get("preview_file"):
            paths_to_delete.append(product["preview_file"].lstrip("/"))
        
        # Thumbs are a list
        thumbs = product.get("preview_thumbs", [])
        for t in thumbs:
            paths_to_delete.append(t.lstrip("/"))
            
        for path_str in paths_to_delete:
            p = pathlib.Path(path_str)
            if p.exists():
                if p.is_file():
                    p.unlink()
                    logger.info(f"Deleted file: {path_str}")
                elif p.is_dir():
                    shutil.rmtree(p)
                    logger.info(f"Deleted directory: {path_str}")
    except Exception as e:
        logger.error(f"Error cleaning up files for product {product.get('id')}: {e}")

def validate_pdf_mime(file_path: str):
    """Simple MIME validation by reading file header"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(4)
            return header == b'%PDF'
    except:
        return False

# ============= PDF UTILITIES =============
def generate_pdf_preview_and_thumbnails(pdf_path: str, selected_pages: list, product_id: str):
    """
    Extract specific pages from a PDF and generate thumbnails for them.
    selected_pages: List of 1-indexed page numbers [1, 3, 5]
    """
    start_time = datetime.now()
    if not HAS_PDF_LIBS:
        return None, []

    if not check_disk_space():
        logger.error(f"Insufficient disk space for product {product_id}")
        return None, []

    if not validate_pdf_mime(pdf_path):
        logger.error(f"Invalid PDF MIME type for {pdf_path}")
        return None, []

    try:
        # Directories
        preview_dir = pathlib.Path("uploads/marketplace/previews")
        thumb_dir = pathlib.Path("uploads/marketplace/thumbnails")
        preview_dir.mkdir(parents=True, exist_ok=True)
        thumb_dir.mkdir(parents=True, exist_ok=True)

        # 1. Generate Preview PDF
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)

        # SECURITY LIMITS
        if total_pages > MAX_PDF_PAGES:
             logger.warning(f"PDF too long ({total_pages} pages) for {product_id}")
             return None, []

        writer = PdfWriter()
        
        # Validate pages
        unique_selected = sorted(list(set(selected_pages)))
        valid_pages = [p for p in unique_selected if 1 <= p <= total_pages]
        
        if not valid_pages or len(valid_pages) > MAX_PREVIEW_PAGES:
            logger.warning(f"Invalid preview pages count ({len(valid_pages)}) for {product_id}")
            return None, []

        for p_num in valid_pages:
            writer.add_page(reader.pages[p_num - 1])

        preview_filename = f"preview_{product_id}.pdf"
        preview_path = preview_dir / preview_filename
        with open(preview_path, "wb") as f:
            writer.write(f)

        # 2. Generate Thumbnails (one for each selected page)
        thumbnails = []
        for i, p_num in enumerate(valid_pages):
            # timeout logic for convert_from_path is not native, we rely on the parent task management
            # but we can wrap it or log duration
            images = convert_from_path(
                pdf_path, 
                first_page=p_num, 
                last_page=p_num,
                size=(400, None),
                timeout=CONVERSION_TIMEOUT_SEC
            )
            if images:
                thumb_filename = f"thumb_{product_id}_p{p_num}.png"
                thumb_path = thumb_dir / thumb_filename
                images[0].save(thumb_path, "PNG")
                thumbnails.append(f"/uploads/marketplace/thumbnails/{thumb_filename}")

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"SUCCESS: Preview generated for {product_id}. Pages: {len(valid_pages)}/{total_pages}. Duration: {duration}s")
        return f"/uploads/marketplace/previews/{preview_filename}", thumbnails

    except Exception as e:
        logger.error(f"FAILURE: Error generating preview for {product_id}: {e}")
        return None, []
def add_watermark_to_pdf(pdf_path: str, buyer_name: str, order_id: str, phone_number: str):
    """Add dynamic watermark to PDF"""
    if not HAS_PDF_LIBS:
        return pdf_path  # Return original if libraries not available
    
    try:
        # Read PDF
        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        
        watermark_text = f"Acheteur: {buyer_name}\nCommande: {order_id}\nMobile: {phone_number}\nDate: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        
        # Add watermark to each page
        for page_num, page in enumerate(reader.pages):
            # Create watermark
            watermark_buffer = BytesIO()
            watermark_canvas = canvas.Canvas(watermark_buffer, pagesize=letter)
            watermark_canvas.setFont("Helvetica", 8)
            watermark_canvas.setFillAlpha(0.3)
            
            # Draw watermark text
            y_pos = 750
            for line in watermark_text.split("\n"):
                watermark_canvas.drawString(50, y_pos, line)
                y_pos -= 15
            
            watermark_canvas.save()
            watermark_buffer.seek(0)
            
            # Merge watermark with page
            watermark_reader = PdfReader(watermark_buffer)
            watermark_page = watermark_reader.pages[0]
            page.merge_page(watermark_page)
            
            writer.add_page(page)
        
        # Save watermarked PDF
        watermarked_path = str(pathlib.Path(pdf_path).parent / f"watermarked_{uuid.uuid4()}.pdf")
        with open(watermarked_path, "wb") as output_file:
            writer.write(output_file)
        
        return watermarked_path
    
    except Exception as e:
        print(f"❌ Error adding watermark: {e}")
        return pdf_path  # Return original on error

def extract_pdf_preview(pdf_path: str, num_pages: int = 3):
    """Extract a small PDF containing only the first N pages as a preview"""
    if not HAS_PDF_LIBS:
        return None
    
    try:
        # Create previews directory if it doesn't exist
        preview_dir = pathlib.Path("uploads/marketplace/previews")
        preview_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate stable preview filename based on original path
        import hashlib
        path_hash = hashlib.md5(str(pdf_path).encode()).hexdigest()
        preview_filename = f"preview_{path_hash}_{num_pages}.pdf"
        preview_path = preview_dir / preview_filename
        
        # Return cached version if exists
        if preview_path.exists():
            return str(preview_path)
            
        # Read original PDF
        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        
        # Take first N pages
        pages_to_copy = min(num_pages, len(reader.pages))
        for i in range(pages_to_copy):
            writer.add_page(reader.pages[i])
            
        # Save preview PDF
        with open(preview_path, "wb") as output_file:
            writer.write(output_file)
        
        return str(preview_path)
    
    except Exception as e:
        print(f"❌ Error extracting PDF preview: {e}")
        return None

def get_pdf_info(pdf_path: str):
    """Get PDF metadata"""
    if not HAS_PDF_LIBS:
        return {"error": "PDF libraries not available"}
    
    try:
        reader = PdfReader(pdf_path)
        return {
            "total_pages": len(reader.pages),
            "metadata": reader.metadata
        }
    except Exception as e:
        print(f"❌ Error reading PDF info: {e}")
        return {"error": str(e)}

# ============= INVOICE GENERATION =============
def generate_invoice_pdf(order_data: dict, buyer_name: str, seller_name: str):
    """Generate invoice PDF for order"""
    if not HAS_PDF_LIBS:
        return None
    
    try:
        invoice_buffer = BytesIO()
        invoice_canvas = canvas.Canvas(invoice_buffer, pagesize=letter)
        
        # Header
        invoice_canvas.setFont("Helvetica-Bold", 16)
        invoice_canvas.drawString(50, 750, "FACTURE / INVOICE")
        
        # Order details
        invoice_canvas.setFont("Helvetica", 10)
        y_pos = 720
        invoice_canvas.drawString(50, y_pos, f"Numéro de commande: {order_data.get('order_number', 'N/A')}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Acheteur: {buyer_name}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Vendeur: {seller_name}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Montant: {order_data.get('total_amount', 0)} {order_data.get('currency', 'USD')}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Méthode de paiement: {order_data.get('payment_method', 'N/A')}")
        y_pos -= 20
        invoice_canvas.drawString(50, y_pos, f"Statut: {order_data.get('status', 'N/A')}")
        
        # Footer
        invoice_canvas.setFont("Helvetica", 8)
        invoice_canvas.drawString(50, 50, "Merci pour votre achat! / Thank you for your purchase!")
        
        invoice_canvas.save()
        invoice_buffer.seek(0)
        
        # Save invoice
        invoice_filename = f"invoice_{order_data.get('order_number')}_{uuid.uuid4()}.pdf"
        invoice_path = pathlib.Path("uploads/invoices") / invoice_filename
        invoice_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(invoice_path, "wb") as f:
            f.write(invoice_buffer.getvalue())
        
        return str(invoice_path)
    
    except Exception as e:
        print(f"❌ Error generating invoice: {e}")
        return None

# ============= RECEIPT GENERATION =============
def generate_receipt(order_data: dict, items: list):
    """Generate receipt for order"""
    receipt_content = {
        "order_number": order_data.get("order_number"),
        "date": datetime.now(timezone.utc).isoformat(),
        "buyer_id": order_data.get("buyer_id"),
        "seller_id": order_data.get("seller_id"),
        "total_amount": order_data.get("total_amount"),
        "currency": order_data.get("currency"),
        "payment_method": order_data.get("payment_method"),
        "payment_status": order_data.get("payment_status"),
        "items": items
    }
    return receipt_content
