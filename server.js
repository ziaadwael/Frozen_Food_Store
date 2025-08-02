const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Initialize data directory and file
async function initializeData() {
  try {
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      await fs.access(DATA_FILE);
    } catch (error) {
      // File doesn't exist, create it with empty array
      await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
      console.log('Created new products.json file');
    }
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// Helper functions
async function readProducts() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading products:', error);
    return [];
  }
}

async function writeProducts(products) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing products:', error);
    return false;
  }
}

function generateId(products) {
  if (products.length === 0) return 1;
  return Math.max(...products.map(p => p.id || 0)) + 1;
}

// API Routes

// Get all products with optional search
app.get('/api/products', async (req, res) => {
  try {
    const products = await readProducts();
    const { search } = req.query;
    
    let filteredProducts = products;
    
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredProducts = products.filter(product => 
        product.name?.toLowerCase().includes(searchTerm) ||
        product.category?.toLowerCase().includes(searchTerm) ||
        product.supplier?.toLowerCase().includes(searchTerm)
      );
    }
    
    res.json({
      success: true,
      data: filteredProducts,
      message: `تم جلب ${filteredProducts.length} منتج`
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المنتجات'
    });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const products = await readProducts();
    const productId = parseInt(req.params.id);
    
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المنتج'
    });
  }
});

// Create new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price, stock, supplier } = req.body;
    
    // Validation
    if (!name || !category || !price || !stock || !supplier) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }
    
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'السعر يجب أن يكون رقم موجب'
      });
    }
    
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'الكمية يجب أن تكون رقم غير سالب'
      });
    }
    
    const products = await readProducts();
    
    // Check if product name already exists
    const existingProduct = products.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج موجود بالفعل'
      });
    }
    
    const newProduct = {
      id: generateId(products),
      name: name.trim(),
      category: category.trim(),
      price: parseFloat(price),
      stock: parseInt(stock),
      supplier: supplier.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    products.push(newProduct);
    
    const success = await writeProducts(products);
    
    if (success) {
      res.status(201).json({
        success: true,
        data: newProduct,
        message: 'تم إضافة المنتج بنجاح'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'خطأ في حفظ المنتج'
      });
    }
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة المنتج'
    });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { name, category, price, stock, supplier } = req.body;
    
    // Validation
    if (!name || !category || !price || !stock || !supplier) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }
    
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'السعر يجب أن يكون رقم موجب'
      });
    }
    
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'الكمية يجب أن تكون رقم غير سالب'
      });
    }
    
    const products = await readProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }
    
    // Check if new name conflicts with another product
    const existingProduct = products.find(p => 
      p.name.toLowerCase() === name.toLowerCase() && p.id !== productId
    );
    
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج موجود بالفعل'
      });
    }
    
    // Update product
    products[productIndex] = {
      ...products[productIndex],
      name: name.trim(),
      category: category.trim(),
      price: parseFloat(price),
      stock: parseInt(stock),
      supplier: supplier.trim(),
      updatedAt: new Date().toISOString()
    };
    
    const success = await writeProducts(products);
    
    if (success) {
      res.json({
        success: true,
        data: products[productIndex],
        message: 'تم تحديث المنتج بنجاح'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'خطأ في حفظ التحديثات'
      });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث المنتج'
    });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const products = await readProducts();
    
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }
    
    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);
    
    const success = await writeProducts(products);
    
    if (success) {
      res.json({
        success: true,
        data: deletedProduct,
        message: 'تم حذف المنتج بنجاح'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'خطأ في حذف المنتج'
      });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف المنتج'
    });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const products = await readProducts();
    
    const stats = {
      totalProducts: products.length,
      totalStock: products.reduce((sum, product) => sum + (product.stock || 0), 0),
      totalValue: products.reduce((sum, product) => 
        sum + ((product.price || 0) * (product.stock || 0)), 0),
      categories: [...new Set(products.map(p => p.category))].length,
      lowStockProducts: products.filter(p => (p.stock || 0) < 10).length
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات'
    });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'خطأ في الخادم'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'الصفحة غير موجودة'
  });
});

// Start server
async function startServer() {
  try {
    await initializeData();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`📁 Data file: ${DATA_FILE}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();