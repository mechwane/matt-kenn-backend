const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Replace app.use(cors()); with:
app.use(cors({
  origin: [
    'http://localhost:3000',           // Local development
    'https://mattkenn-minibar-mix.web.app', // Your Firebase URL
    'https://your-project-id.firebaseapp.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());


// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Utility function to format price
const formatPrice = (price) => `₦${price.toLocaleString()}`;

// Generate order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `MK-${timestamp}-${randomStr}`.toUpperCase();
};

// Create orders directory if it doesn't exist
const ensureOrdersDirectory = async () => {
  const ordersDir = path.join(__dirname, 'orders');
  try {
    await fs.access(ordersDir);
  } catch {
    await fs.mkdir(ordersDir, { recursive: true });
  }
};

// Create pending orders directory if it doesn't exist
const ensurePendingOrdersDirectory = async () => {
  const pendingDir = path.join(__dirname, 'pending-orders');
  try {
    await fs.access(pendingDir);
  } catch {
    await fs.mkdir(pendingDir, { recursive: true });
  }
};

// Save order to file
const saveOrderToFile = async (order) => {
  await ensureOrdersDirectory();
  const fileName = `order_${order.orderId}_${Date.now()}.json`;
  const filePath = path.join(__dirname, 'orders', fileName);
  await fs.writeFile(filePath, JSON.stringify(order, null, 2));
  return filePath;
};

// Save pending order to file
const savePendingOrderToFile = async (order) => {
  await ensurePendingOrdersDirectory();
  const fileName = `pending_${order.orderId}_${Date.now()}.json`;
  const filePath = path.join(__dirname, 'pending-orders', fileName);
  await fs.writeFile(filePath, JSON.stringify(order, null, 2));
  return filePath;
};

// Find pending order
const findPendingOrder = async (orderId) => {
  const pendingDir = path.join(__dirname, 'pending-orders');
  
  try {
    const files = await fs.readdir(pendingDir);
    const orderFile = files.find(file => file.includes(orderId));
    
    if (!orderFile) return null;
    
    const orderData = await fs.readFile(path.join(pendingDir, orderFile), 'utf8');
    return JSON.parse(orderData);
  } catch {
    return null;
  }
};

// Delete pending order
const deletePendingOrder = async (orderId) => {
  const pendingDir = path.join(__dirname, 'pending-orders');
  
  try {
    const files = await fs.readdir(pendingDir);
    const orderFile = files.find(file => file.includes(orderId));
    
    if (orderFile) {
      await fs.unlink(path.join(pendingDir, orderFile));
    }
  } catch (error) {
    console.error('Error deleting pending order:', error);
  }
};

// Generate order email HTML
const generateOrderEmailHTML = (order) => {
  const itemsHTML = order.items.map(item => {
    let itemDetails = `${item.name} x ${item.quantity}`;
    
    if (item.itemQuantity) {
      itemDetails += ` (${item.itemQuantity} pieces)`;
    }
    if (item.soup) {
      itemDetails += ` + ${item.soup.name}`;
    }
    if (item.meat && item.meat.length > 0) {
      const meatList = item.meat.map(m => `${m.name} (${m.quantity}x)`).join(', ');
      itemDetails += ` + ${meatList}`;
    }
    if (item.spoons) {
      itemDetails += ` (${item.spoons} spoons + Takeaway)`;
    }
    if (item.palmWineSize) {
      itemDetails += ` (${item.palmWineSize.name})`;
    }
    if (item.hasAutoTakeaway) {
      itemDetails += ` + Takeaway`;
    }

    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${itemDetails}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice((item.finalPrice || item.price) * item.quantity)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - Matt-Kenn Restaurant</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #059669, #ea580c); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .total-row { background: #f0f9ff; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        .bank-details { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Confirmed!</h1>
          <p>Thank you for choosing Matt-Kenn Restaurant & Mini Bar</p>
          <p>website created by Adam adekanye(Algma Tech)- for more info whatsApp: 09069522633</p>
        </div>
        
        <div class="content">
          <div class="order-details">
            <h3>Order #${order.orderId}</h3>
            <p><strong>Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.customerPhone}</p>
            <p><strong>Email:</strong> ${order.customerEmail}</p>
            ${order.deliveryArea ? `
              <p><strong>Delivery Address:</strong> ${order.customerAddress}</p>
              <p><strong>Delivery Area:</strong> ${order.deliveryArea.name} (${order.deliveryArea.zone})</p>
            ` : ''}
          </div>

          <div class="order-details">
            <h3>Order Summary</h3>
            <table>
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
                <tr>
                  <td style="padding: 10px; border-top: 2px solid #ddd;"><strong>Subtotal:</strong></td>
                  <td style="padding: 10px; border-top: 2px solid #ddd; text-align: right;"><strong>${formatPrice(order.subtotal)}</strong></td>
                </tr>
                ${order.deliveryFee > 0 ? `
                  <tr>
                    <td style="padding: 10px;">Delivery Fee:</td>
                    <td style="padding: 10px; text-align: right;">${formatPrice(order.deliveryFee)}</td>
                  </tr>
                ` : ''}
                <tr class="total-row">
                  <td style="padding: 15px; font-size: 18px;"><strong>Total:</strong></td>
                  <td style="padding: 15px; text-align: right; font-size: 18px; color: #059669;"><strong>${formatPrice(order.total)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="bank-details">
            <h3>💳 Payment Instructions</h3>
            <p>Please make a bank transfer to complete your order:</p>
            <p><strong>Account Name:</strong> ${order.bankDetails.accountName}</p>
            <p><strong>Account Number:</strong> ${order.bankDetails.accountNumber}</p>
            <p><strong>Bank:</strong> ${order.bankDetails.bankName}</p>
            <p><strong>Amount:</strong> ${formatPrice(order.total)}</p>
            
            <h4>Next Steps:</h4>
            <ol>
              <li>Make the payment using the bank details above</li>
              <li>Take a screenshot of your payment confirmation</li>
              <li>Send the payment proof to our WhatsApp: +234 8145811714</li>
              <li>Your order will be prepared once payment is confirmed</li>
              <li>We'll contact you for delivery/pickup arrangements</li>
            </ol>
          </div>

          <div class="footer">
            <p>Thank you for choosing Matt-Kenn Restaurant & Mini Bar!</p>
            <p>📱 WhatsApp: +234 8145811714 | 📧 Email: themixologistmattkenn@gmail.com</p>
            <p>🕒 Open Daily: 10:00 AM - 10:00 PM</p>
            <p>website created by Adam adekanye(Algma Tech)- for more info whatsApp: 09069522633</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Email templates for payment flow
const generatePaymentInstructionsEmail = (order) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Instructions - Matt-Kenn Restaurant</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .payment-box { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 15px 0; }
        .urgent { background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 15px 0; }
        .steps { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .total-amount { font-size: 24px; color: #dc2626; font-weight: bold; text-align: center; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Payment Required</h1>
          <p>Complete your payment to confirm your order</p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <h3>🚨 Important: Payment Deadline</h3>
            <p><strong>You have 30 minutes to complete payment</strong></p>
            <p><strong>Deadline:</strong> ${new Date(order.paymentDeadline).toLocaleString()}</p>
            <p>If payment is not received by this time, your order will be cancelled.</p>
          </div>

          <div class="payment-box">
            <h3>💳 Payment Details</h3>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Account Name:</strong> ${order.bankDetails.accountName}</p>
            <p><strong>Account Number:</strong> ${order.bankDetails.accountNumber}</p>
            <p><strong>Bank:</strong> ${order.bankDetails.bankName}</p>
            <div class="total-amount">
              Amount to Pay: ${formatPrice(order.total)}
            </div>
          </div>

          <div class="steps">
            <h3>📋 Payment Steps</h3>
            <ol>
              <li><strong>Make bank transfer</strong> using the details above</li>
              <li><strong>Take a screenshot</strong> of your payment confirmation</li>
              <li><strong>Submit payment proof</strong> by replying to this email with:
                <ul>
                  <li>Payment screenshot</li>
                  <li>Transaction reference number</li>
                  <li>Order ID: <strong>${order.orderId}</strong></li>
                </ul>
              </li>
              <li><strong>Or WhatsApp us:</strong> +234 8145811714</li>
            </ol>
          </div>

          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>📦 Your Order Summary</h3>
            ${order.items.map(item => `
              <p>• ${item.name} x ${item.quantity} - ${formatPrice((item.finalPrice || item.price) * item.quantity)}</p>
            `).join('')}
            <hr>
            <p><strong>Subtotal:</strong> ${formatPrice(order.subtotal)}</p>
            ${order.deliveryFee > 0 ? `<p><strong>Delivery:</strong> ${formatPrice(order.deliveryFee)}</p>` : ''}
            <p style="font-size: 18px; color: #059669;"><strong>Total: ${formatPrice(order.total)}</strong></p>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
            <p>Questions? Contact us:</p>
            <p>📱 WhatsApp: +234 800 MATTKENN | 📧 Email: ${process.env.EMAIL_USER}</p>
            <p>website created by Adam adekanye(Algma Tech)- for more info whatsApp: 09069522633</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generatePaymentConfirmationEmail = (order) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Confirmed - Matt-Kenn Restaurant</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #059669, #ea580c); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .success-box { background: #dcfce7; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin: 15px 0; text-align: center; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Payment Confirmed!</h1>
          <p>Your order is now being prepared</p>
        </div>
        
        <div class="content">
          <div class="success-box">
            <h2>🎉 Thank you, ${order.customerName}!</h2>
            <p>We've received your payment and your order is now confirmed.</p>
            <p><strong>Order #${order.orderId}</strong></p>
            <p><strong>Estimated preparation time:</strong> 30-45 minutes</p>
          </div>

          <div class="order-details">
            <h3>📦 Order Details</h3>
            ${order.items.map(item => `
              <p>• ${item.name} x ${item.quantity}</p>
            `).join('')}
            <hr>
            <p><strong>Total Paid:</strong> ${formatPrice(order.total)}</p>
            ${order.deliveryArea ? `<p><strong>Delivery to:</strong> ${order.customerAddress}</p>` : ''}
          </div>

          <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>⏰ What's Next?</h3>
            <ol>
              <li>We're preparing your order now</li>
              <li>You'll receive updates via SMS/WhatsApp</li>
              <li>We'll contact you when ready for delivery/pickup</li>
              <li>Enjoy your meal! 🍽️</li>
            </ol>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
            <p>Track your order or contact us:</p>
            <p>📱 WhatsApp: +234 8145811714 | 📧 Email: ${process.env.EMAIL_USER}</p>
            <p>website created by Adam adekanye(Algma Tech)- for more info whatsApp: 09069522633</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateRestaurantNotificationEmail = (order) => {
  return `
    <h2>💰 Payment Confirmed - New Order Ready for Preparation!</h2>
    <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.customerPhone}</p>
      <p><strong>Email:</strong> ${order.customerEmail}</p>
      <p><strong>Payment Reference:</strong> ${order.paymentReference || 'N/A'}</p>
      <p><strong>Total Paid:</strong> ${formatPrice(order.total)}</p>
      ${order.deliveryArea ? `<p><strong>Delivery:</strong> ${order.customerAddress} (${order.deliveryArea.name})</p>` : ''}
    </div>
    
    <h3>📦 Items to Prepare:</h3>
    <ul>
      ${order.items.map(item => {
        let itemDetails = `${item.name} x ${item.quantity}`;
        if (item.itemQuantity) itemDetails += ` (${item.itemQuantity} pieces)`;
        if (item.soup) itemDetails += ` + ${item.soup.name}`;
        if (item.meat && item.meat.length > 0) {
          const meatList = item.meat.map(m => `${m.name} (${m.quantity}x)`).join(', ');
          itemDetails += ` + ${meatList}`;
        }
        if (item.spoons) itemDetails += ` (${item.spoons} spoons)`;
        if (item.palmWineSize) itemDetails += ` (${item.palmWineSize.name})`;
        return `<li>${itemDetails}</li>`;
      }).join('')}
    </ul>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <h3>⚡ Action Required:</h3>
      <p>✅ Payment confirmed - START PREPARING ORDER</p>
      <p>📱 Contact customer: ${order.customerPhone}</p>
      <p>⏰ Estimated prep time: 30-45 minutes</p>
    </div>
  `;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Matt-Kenn Backend is running!' });
});

// Create pending order (before payment)
app.post('/api/orders/pending', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      deliveryArea,
      items,
      subtotal,
      deliveryFee,
      total,
      bankDetails
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Generate order ID
    const orderId = generateOrderId();

    // Create pending order object
    const pendingOrder = {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      deliveryArea,
      items,
      subtotal,
      deliveryFee,
      total,
      bankDetails,
      orderDate: new Date().toISOString(),
      status: 'pending_payment',
      paymentDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      paymentProofUploaded: false
    };

    // Save pending order to file
    await savePendingOrderToFile(pendingOrder);

    // Send payment instructions email to customer
    const transporter = createEmailTransporter();
    const paymentEmailHTML = generatePaymentInstructionsEmail(pendingOrder);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: `Payment Required - Order #${orderId} - Matt-Kenn Restaurant`,
      html: paymentEmailHTML
    });

    res.json({
      success: true,
      message: 'Order created. Payment required to confirm.',
      orderId: orderId,
      order: pendingOrder,
      paymentDeadline: pendingOrder.paymentDeadline
    });

  } catch (error) {
    console.error('Error creating pending order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// Submit payment proof
app.post('/api/orders/:orderId/payment-proof', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentReference, paymentMethod, customerNote } = req.body;

    // Find the pending order
    const pendingOrder = await findPendingOrder(orderId);
    
    if (!pendingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or expired'
      });
    }

    // Check if payment deadline has passed
    if (new Date() > new Date(pendingOrder.paymentDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Payment deadline has expired. Please place a new order.'
      });
    }

    // Update order with payment info
    const updatedOrder = {
      ...pendingOrder,
      status: 'payment_submitted',
      paymentProofUploaded: true,
      paymentReference,
      paymentMethod: paymentMethod || 'Bank Transfer',
      customerNote: customerNote || '',
      paymentSubmissionDate: new Date().toISOString()
    };

    // Save updated order
    await saveOrderToFile(updatedOrder);
    
    // Delete pending order file
    await deletePendingOrder(orderId);

    // Send confirmation emails
    const transporter = createEmailTransporter();
    
    // Customer confirmation email
    const confirmationEmailHTML = generatePaymentConfirmationEmail(updatedOrder);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: updatedOrder.customerEmail,
      subject: `Payment Received - Order #${orderId} Being Processed`,
      html: confirmationEmailHTML
    });

    // Restaurant notification email
    const restaurantNotificationHTML = generateRestaurantNotificationEmail(updatedOrder);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.RESTAURANT_EMAIL || process.env.EMAIL_USER,
      subject: `🍽️ Payment Received - Order #${orderId} - ${updatedOrder.customerName}`,
      html: restaurantNotificationHTML
    });

    res.json({
      success: true,
      message: 'Payment proof submitted successfully. Your order is being processed.',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error submitting payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit payment proof',
      error: error.message
    });
  }
});

// Get order by ID
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // First check in completed orders
    const ordersDir = path.join(__dirname, 'orders');
    try {
      const files = await fs.readdir(ordersDir);
      const orderFile = files.find(file => file.includes(orderId));
      
      if (orderFile) {
        const orderData = await fs.readFile(path.join(ordersDir, orderFile), 'utf8');
        const order = JSON.parse(orderData);
        
        return res.json({
          success: true,
          order: order
        });
      }
    } catch (error) {
      // Directory might not exist yet
    }
    
    // Then check in pending orders
    const pendingOrder = await findPendingOrder(orderId);
    if (pendingOrder) {
      return res.json({
        success: true,
        order: pendingOrder
      });
    }
    
    // If not found in either location
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// Get all orders (admin only)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = [];
    
    // Get completed orders
    const ordersDir = path.join(__dirname, 'orders');
    try {
      const files = await fs.readdir(ordersDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const orderData = await fs.readFile(path.join(ordersDir, file), 'utf8');
          const order = JSON.parse(orderData);
          orders.push(order);
        }
      }
    } catch (error) {
      // Orders directory doesn't exist yet
    }
    
    // Get pending orders
    const pendingDir = path.join(__dirname, 'pending-orders');
    try {
      const files = await fs.readdir(pendingDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const orderData = await fs.readFile(path.join(pendingDir, file), 'utf8');
          const order = JSON.parse(orderData);
          orders.push(order);
        }
      }
    } catch (error) {
      // Pending orders directory doesn't exist yet
    }
    
    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.RESTAURANT_EMAIL || process.env.EMAIL_USER,
      subject: `Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Matt-Kenn Backend Server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
  console.log(`🍽️ Restaurant email: ${process.env.RESTAURANT_EMAIL || 'Using default'}`);
});

module.exports = app;