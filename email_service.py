"""
Email Service: Handles email delivery for the application using SendGrid
"""
import os
import base64
import logging
from io import BytesIO
from reportlab.pdfgen import canvas
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail, Attachment, FileContent, FileName, 
    FileType, Disposition, ContentId, Email, Content
)

# Configure logging
logger = logging.getLogger(__name__)

def get_sender_email():
    """Get the sender email from environment, with fallback to default"""
    sender_email = os.environ.get('SENDER_EMAIL')
    if not sender_email or "@" not in sender_email:
        # Use a default sender email as fallback
        sender_email = "zhi@zhicourses.org"
        logger.warning(f"SENDER_EMAIL not set. Using default sender: {sender_email}")
    logger.info(f"Using sender email: {sender_email}")
    return sender_email

def validate_sendgrid_key():
    """Validate that SendGrid API key is configured properly"""
    sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
    
    if not sendgrid_api_key or len(sendgrid_api_key) < 10:
        logger.error(f"Invalid SendGrid API key: {sendgrid_api_key[:5] if sendgrid_api_key else 'None'}")
        return False, "SendGrid API key not configured properly"
        
    return True, sendgrid_api_key

def create_pdf_from_text(text):
    """Create a PDF document from text content"""
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    width = 500  # Maximum width in points (leaving margins)
    y = 800  # Start from top of page
    font_name = 'Helvetica'
    font_size = 12
    pdf.setFont(font_name, font_size)
    
    # Process each paragraph
    for paragraph in text.split('\n'):
        if not paragraph.strip():
            y -= 15  # Add space between paragraphs
            continue
            
        words = paragraph.split()
        line = []
        
        for word in words:
            line.append(word)
            line_width = pdf.stringWidth(' '.join(line), font_name, font_size)
            
            if line_width > width:
                # Remove last word as it caused overflow
                line.pop()
                # Draw the line
                pdf.drawString(50, y, ' '.join(line))
                y -= 15
                # Start new line with the overflow word
                line = [word]
                
            # Check if we need a new page
            if y < 50:
                pdf.showPage()
                pdf.setFont(font_name, font_size)
                y = 800
                
        # Draw remaining text in the line
        if line:
            pdf.drawString(50, y, ' '.join(line))
            y -= 15
            
    pdf.save()
    buffer.seek(0)
    
    return buffer

def send_email(to_email, subject, text_content, attachment_buffer=None):
    """
    Send email using SendGrid
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        text_content: Plain text content for the email
        attachment_buffer: Optional BytesIO buffer containing PDF attachment
    
    Returns:
        tuple: (success, message)
    """
    # Validate SendGrid API key
    is_valid, api_key_or_error = validate_sendgrid_key()
    if not is_valid:
        return False, api_key_or_error
    
    sendgrid_api_key = api_key_or_error
    sender_email = get_sender_email()
    
    try:
        # Create the email object
        message = Mail(
            from_email=sender_email,
            to_emails=to_email,
            subject=subject,
            plain_text_content=text_content
        )
        
        # Add attachment if provided
        if attachment_buffer:
            # Encode the PDF attachment
            encoded_file = base64.b64encode(attachment_buffer.read()).decode()
            
            # Add attachment to email
            attachment = Attachment()
            attachment.file_content = FileContent(encoded_file)
            attachment.file_name = FileName('rewritten_text.pdf')
            attachment.file_type = FileType('application/pdf')
            attachment.disposition = Disposition('attachment')
            attachment.content_id = ContentId('Rewritten Text')
            message.attachment = attachment
        
        # Initialize SendGrid client
        sg = SendGridAPIClient(sendgrid_api_key)
        
        # Log sanitized key for troubleshooting (only first and last 5 chars)
        safe_api_key = sendgrid_api_key[:5] + '...' + sendgrid_api_key[-5:]
        logger.debug(f"Using SendGrid API Key: {safe_api_key}")
        logger.debug(f"From: {sender_email}, To: {to_email}, Subject: {subject}")
        
        # Send the email
        response = sg.send(message)
        
        # Check response
        if response.status_code == 202:
            logger.info(f"Email sent successfully to {to_email}")
            return True, "Email sent successfully"
        else:
            # Get detailed error information from response
            error_detail = response.body.decode('utf-8') if hasattr(response, 'body') else 'No error details'
            logger.error(f"SendGrid error: Status code {response.status_code}. Details: {error_detail}")
            return False, f"Failed to send email. Status code: {response.status_code}. Details: {error_detail}"
            
    except Exception as e:
        logger.error(f"Exception during email sending: {str(e)}")
        return False, f"Error sending email: {str(e)}"
        
def send_text_email(to_email, subject, text, is_long=False):
    """
    Send text content via email, with automatic handling for long content
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        text: The text content to send
        is_long: Force handling as long text (create PDF attachment)
    
    Returns:
        tuple: (success, message)
    """
    # Check if text is long (more than ~500 words or ~2 pages)
    if is_long or len(text.split()) > 500:
        # For long text, create PDF attachment
        logger.info(f"Creating PDF attachment for long text ({len(text.split())} words)")
        pdf_buffer = create_pdf_from_text(text)
        
        # Send email with attachment and brief body text
        return send_email(
            to_email=to_email,
            subject=subject,
            text_content="Please find your rewritten text attached.",
            attachment_buffer=pdf_buffer
        )
    else:
        # For shorter text, include directly in email body
        logger.info(f"Sending plain text email ({len(text.split())} words)")
        return send_email(
            to_email=to_email,
            subject=subject,
            text_content=text
        )