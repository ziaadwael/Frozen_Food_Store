// إعدادات API
const API_BASE_URL = "http://localhost:3000/api";
let editingProductId = null;
let productToDeleteId = null;
let searchTimeout = null;

// التحقق من حالة الاتصال
async function checkConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (response.ok) {
      updateConnectionStatus(true);
      return true;
    } else {
      updateConnectionStatus(false);
      return false;
    }
  } catch (error) {
    console.error('Connection check failed:', error);
    updateConnectionStatus(false);
    return false;
  }
}

// تحديث حالة الاتصال
function updateConnectionStatus(connected) {
  const statusElement = document.getElementById("connectionStatus");
  if (!statusElement) {
    console.warn('Connection status element not found');
    return;
  }
  
  if (connected) {
    statusElement.textContent = "🟢 متصل بالخادم";
    statusElement.className = "connection-status connected";
  } else {
    statusElement.textContent = "🔴 غير متصل بالخادم";
    statusElement.className = "connection-status disconnected";
  }
}

// تحميل الإحصائيات
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: فشل في تحميل الإحصائيات`);
    }

    const result = await response.json();
    if (result.success) {
      const stats = result.data;
      
      // تحديث العناصر مع التحقق من وجودها
      const elements = {
        totalProducts: stats.totalProducts || 0,
        totalStock: stats.totalStock || 0,
        totalValue: (stats.totalValue || 0).toLocaleString('ar-SA'),
        totalCategories: stats.categories || 0
      };
      
      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        } else {
          console.warn(`Element with id '${id}' not found`);
        }
      });
    } else {
      throw new Error(result.message || "فشل في تحميل الإحصائيات");
    }
  } catch (error) {
    console.error("خطأ في تحميل الإحصائيات:", error);
    showAlert("خطأ في تحميل الإحصائيات: " + error.message, "error");
  }
}

// تحميل المنتجات
async function loadProducts(searchTerm = "") {
  const refreshLoading = document.getElementById("refreshLoading");
  const tableBody = document.getElementById("productsTableBody");

  if (!tableBody) {
    console.error('Products table body element not found');
    return;
  }

  try {
    if (refreshLoading) {
      refreshLoading.style.display = "inline-block";
    }

    let url = `${API_BASE_URL}/products`;
    if (searchTerm && searchTerm.trim()) {
      url += `?search=${encodeURIComponent(searchTerm.trim())}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: فشل في تحميل المنتجات`);
    }

    const result = await response.json();
    if (result.success) {
      displayProducts(result.data);
      await loadStats(); // تحديث الإحصائيات
    } else {
      throw new Error(result.message || "خطأ غير معروف");
    }
  } catch (error) {
    console.error("خطأ في تحميل المنتجات:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 50px; color: #e74c3c;">
          ❌ خطأ في تحميل البيانات: ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
    showAlert("خطأ في تحميل المنتجات: " + error.message, "error");
  } finally {
    if (refreshLoading) {
      refreshLoading.style.display = "none";
    }
  }
}

// دالة لحماية النصوص من XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// عرض المنتجات
function displayProducts(products) {
  const tableBody = document.getElementById("productsTableBody");
  
  if (!tableBody) {
    console.error('Products table body element not found');
    return;
  }

  if (!products || products.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 50px; color: #7f8c8d;">
          📦 لا توجد منتجات
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = products
    .map((product) => {
      // التحقق من صحة بيانات المنتج
      if (!product || typeof product.id === 'undefined') {
        console.warn('Invalid product data:', product);
        return '';
      }
      
      const categoryClass = `category-${escapeHtml(String(product.category || '').split(" ")[0])}`;
      const productName = escapeHtml(String(product.name || ''));
      const productCategory = escapeHtml(String(product.category || ''));
      const productSupplier = escapeHtml(String(product.supplier || ''));
      const productPrice = parseFloat(product.price) || 0;
      const productStock = parseInt(product.stock) || 0;
      
      return `
        <tr class="${categoryClass}">
          <td>${escapeHtml(String(product.id))}</td>
          <td>${productName}</td>
          <td>${productCategory}</td>
          <td>${productPrice.toLocaleString('ar-SA')} ريال</td>
          <td>${productStock}</td>
          <td>${productSupplier}</td>
          <td class="actions-column">
            <button class="btn btn-warning" onclick="editProduct(${product.id})" aria-label="تعديل ${productName}">
              ✏️ تعديل
            </button>
            <button class="btn btn-danger" onclick="showDeleteModal(${product.id}, '${productName.replace(/'/g, "\\'")}')">
              🗑️ حذف
            </button>
          </td>
        </tr>
      `;
    })
    .filter(row => row) // إزالة الصفوف الفارغة
    .join("");
}

// التحقق من صحة بيانات النموذج
function validateFormData(formData) {
  const errors = [];
  
  if (!formData.name || formData.name.length < 2) {
    errors.push('اسم المنتج يجب أن يكون على الأقل حرفين');
  }
  
  if (!formData.category) {
    errors.push('يجب اختيار فئة المنتج');
  }
  
  if (isNaN(formData.price) || formData.price <= 0) {
    errors.push('السعر يجب أن يكون رقم موجب');
  }
  
  if (isNaN(formData.stock) || formData.stock < 0) {
    errors.push('الكمية يجب أن تكون رقم غير سالب');
  }
  
  if (!formData.supplier || formData.supplier.length < 2) {
    errors.push('اسم المورد يجب أن يكون على الأقل حرفين');
  }
  
  return errors;
}

// إضافة أو تحديث منتج
function initializeProductForm() {
  const form = document.getElementById("productForm");
  
  if (!form) {
    console.error('Product form not found');
    return;
  }
  
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    const submitLoading = document.getElementById("submitLoading");

    if (!submitBtn) {
      console.error('Submit button not found');
      return;
    }

    try {
      submitBtn.disabled = true;
      if (submitLoading) {
        submitLoading.style.display = "inline-block";
      }

      // جمع بيانات النموذج
      const formData = {
        name: document.getElementById("productName")?.value?.trim() || '',
        category: document.getElementById("productCategory")?.value || '',
        price: parseFloat(document.getElementById("productPrice")?.value) || 0,
        stock: parseInt(document.getElementById("productStock")?.value) || 0,
        supplier: document.getElementById("productSupplier")?.value?.trim() || '',
      };

      // التحقق من صحة البيانات
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      let response;
      const fetchOptions = {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        signal: AbortSignal.timeout(15000)
      };

      if (editingProductId) {
        // تحديث منتج موجود
        response = await fetch(`${API_BASE_URL}/products/${editingProductId}`, {
          method: "PUT",
          ...fetchOptions
        });
      } else {
        // إضافة منتج جديد
        response = await fetch(`${API_BASE_URL}/products`, {
          method: "POST",
          ...fetchOptions
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: فشل في العملية`);
      }

      const result = await response.json();

      if (result.success) {
        showAlert(result.message, "success");
        form.reset();
        cancelEdit();
        await loadProducts();
      } else {
        throw new Error(result.message || "فشل في العملية");
      }
    } catch (error) {
      console.error("خطأ في العملية:", error);
      showAlert("خطأ: " + error.message, "error");
    } finally {
      submitBtn.disabled = false;
      if (submitLoading) {
        submitLoading.style.display = "none";
      }
    }
  });
}

// تعديل منتج
async function editProduct(id) {
  if (!id) {
    showAlert('معرف المنتج غير صحيح', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: فشل في جلب بيانات المنتج`);
    }

    const result = await response.json();
    if (result.success && result.data) {
      const product = result.data;

      editingProductId = id;
      
      // تحديث حقول النموذج مع التحقق من وجود العناصر
      const fields = {
        editingId: id,
        productName: product.name || '',
        productCategory: product.category || '',
        productPrice: product.price || 0,
        productStock: product.stock || 0,
        productSupplier: product.supplier || ''
      };
      
      Object.entries(fields).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
          element.value = value;
        } else {
          console.warn(`Form field '${fieldId}' not found`);
        }
      });

      // تحديث واجهة النموذج
      const formTitle = document.getElementById("formTitle");
      const submitBtn = document.getElementById("submitBtn");
      const cancelBtn = document.getElementById("cancelBtn");
      
      if (formTitle) formTitle.textContent = "✏️ تعديل المنتج";
      if (submitBtn) {
        submitBtn.innerHTML = '💾 حفظ التعديل <span id="submitLoading" class="loading" style="display: none;"></span>';
      }
      if (cancelBtn) cancelBtn.style.display = "inline-block";

      // التمرير إلى النموذج
      const formCard = document.querySelector(".card");
      if (formCard) {
        formCard.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      throw new Error(result.message || "فشل في جلب البيانات");
    }
  } catch (error) {
    console.error("خطأ في تعديل المنتج:", error);
    showAlert("خطأ في جلب بيانات المنتج: " + error.message, "error");
  }
}

// إلغاء التعديل
function cancelEdit() {
  editingProductId = null;
  
  const elements = {
    editingId: '',
    formTitle: "➕ إضافة منتج جديد",
    submitBtn: '💾 حفظ المنتج <span id="submitLoading" class="loading" style="display: none;"></span>',
    cancelBtn: 'none'
  };
  
  const editingIdEl = document.getElementById("editingId");
  if (editingIdEl) editingIdEl.value = "";
  
  const form = document.getElementById("productForm");
  if (form) form.reset();
  
  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.textContent = elements.formTitle;
  
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.innerHTML = elements.submitBtn;
  
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) cancelBtn.style.display = elements.cancelBtn;
  
  clearAlert();
}

// عرض نافذة تأكيد الحذف
function showDeleteModal(id, name) {
  if (!id) {
    showAlert('معرف المنتج غير صحيح', 'error');
    return;
  }
  
  productToDeleteId = id;
  
  const productNameEl = document.getElementById("productToDelete");
  const modal = document.getElementById("deleteModal");
  
  if (productNameEl) {
    productNameEl.textContent = name || 'منتج غير محدد';
  }
  
  if (modal) {
    modal.style.display = "block";
  } else {
    console.error('Delete modal not found');
  }
}

// إغلاق نافذة الحذف
function closeDeleteModal() {
  const modal = document.getElementById("deleteModal");
  if (modal) {
    modal.style.display = "none";
  }
  productToDeleteId = null;
}

// تأكيد الحذف
async function confirmDelete() {
  if (!productToDeleteId) {
    showAlert('لم يتم تحديد منتج للحذف', 'error');
    return;
  }

  const deleteLoading = document.getElementById("deleteLoading");

  try {
    if (deleteLoading) {
      deleteLoading.style.display = "inline-block";
    }

    const response = await fetch(`${API_BASE_URL}/products/${productToDeleteId}`, {
      method: "DELETE",
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: فشل في الحذف`);
    }

    const result = await response.json();

    if (result.success) {
      showAlert(result.message, "success");
      await loadProducts();
      closeDeleteModal();
    } else {
      throw new Error(result.message || "فشل في الحذف");
    }
  } catch (error) {
    console.error("خطأ في حذف المنتج:", error);
    showAlert("خطأ في الحذف: " + error.message, "error");
  } finally {
    if (deleteLoading) {
      deleteLoading.style.display = "none";
    }
  }
}

// البحث في المنتجات
function initializeSearch() {
  const searchInput = document.getElementById("searchInput");
  
  if (!searchInput) {
    console.warn('Search input not found');
    return;
  }
  
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.trim();

    // إلغاء البحث السابق
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // بحث جديد بعد تأخير قصير
    searchTimeout = setTimeout(() => {
      loadProducts(searchTerm);
    }, 500);
  });
}

// عرض التنبيهات
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById("alertContainer");
  
  if (!alertContainer) {
    console.error('Alert container not found');
    return;
  }
  
  const alertClass = type === "success" 
    ? "alert-success" 
    : type === "info" 
    ? "alert-info" 
    : "alert-error";
    
  alertContainer.innerHTML = `<div class="alert ${alertClass}">${escapeHtml(message)}</div>`;

  // إزالة التنبيه تلقائياً بعد 5 ثوانٍ
  setTimeout(() => {
    clearAlert();
  }, 5000);
}

// مسح التنبيهات
function clearAlert() {
  const alertContainer = document.getElementById("alertContainer");
  if (alertContainer) {
    alertContainer.innerHTML = "";
  }
}

// إغلاق النافذة المنبثقة عند النقر خارجها
function initializeModalHandlers() {
  window.addEventListener('click', function (event) {
    const modal = document.getElementById("deleteModal");
    if (modal && event.target === modal) {
      closeDeleteModal();
    }
  });
}

// تهيئة الصفحة
document.addEventListener("DOMContentLoaded", async function () {
  try {
    // تهيئة المكونات
    initializeProductForm();
    initializeSearch();
    initializeModalHandlers();
    
    // التحقق من الاتصال وتحميل البيانات
    const connected = await checkConnection();
    if (connected) {
      await loadProducts();
    } else {
      showAlert(
        "فشل في الاتصال بالخادم. تأكد من تشغيل الخادم على المنفذ 3000",
        "error"
      );
    }

    // فحص الاتصال كل 30 ثانية
    setInterval(checkConnection, 30000);
    
  } catch (error) {
    console.error('Error during page initialization:', error);
    showAlert('خطأ في تهيئة الصفحة: ' + error.message, 'error');
  }
});