// Image Manager - Handles upload, resize, and ImgBB integration
const ImageManager = {
  apiKey: localStorage.getItem('amy_imgbb_api_key') || '',
  
  init() {
    this.modal = document.getElementById('imageModal');
    this.closeBtn = document.getElementById('closeImageModal');
    this.cancelBtn = document.getElementById('cancelImageBtn');
    this.saveBtn = document.getElementById('saveImageBtn');
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('imageFileInput');
    this.urlInput = document.getElementById('imgUrlInput');
    this.captionInput = document.getElementById('imgCaption');
    this.sizeSelect = document.getElementById('imgSize');
    this.positionSelect = document.getElementById('imgPosition');
    this.uploadPreview = document.getElementById('uploadPreview');
    this.uploadPlaceholder = document.getElementById('uploadPlaceholder');
    
    this.currentCallback = null;
    this.currentDataUrl = null;
    
    this.bindEvents();
  },
  
  bindEvents() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        e.target.classList.add('active');
        document.getElementById(`tab-${e.target.dataset.tab}`).style.display = 'block';
      });
    });
    
    // Modal controls
    this.closeBtn.addEventListener('click', () => this.hideModal());
    this.cancelBtn.addEventListener('click', () => this.hideModal());
    
    // Dropzone
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this.processFile(e.dataTransfer.files[0]);
      }
    });
    
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.processFile(e.target.files[0]);
      }
    });
    
    // Save button
    this.saveBtn.addEventListener('click', () => this.save());
  },
  
  showModal(existingData, callback) {
    this.currentCallback = callback;
    this.currentDataUrl = null;
    
    // Reset or fill form
    if (existingData) {
      if (existingData.imageUrl && existingData.imageUrl.startsWith('http')) {
        this.urlInput.value = existingData.imageUrl;
        // switch to url tab
        document.querySelector('.tab-btn[data-tab="url"]').click();
      } else {
        this.urlInput.value = '';
        document.querySelector('.tab-btn[data-tab="upload"]').click();
      }
      this.captionInput.value = existingData.imageCaption || '';
      this.sizeSelect.value = existingData.imageSize || '100%';
      this.positionSelect.value = existingData.imagePosition || 'center';
      
      if (existingData.imageUrl) {
        this.setPreview(existingData.imageUrl);
      } else {
        this.resetPreview();
      }
    } else {
      this.urlInput.value = '';
      this.captionInput.value = '';
      this.sizeSelect.value = '100%';
      this.positionSelect.value = 'center';
      this.resetPreview();
      document.querySelector('.tab-btn[data-tab="upload"]').click();
    }
    
    this.modal.classList.add('active');
  },
  
  hideModal() {
    this.modal.classList.remove('active');
    this.fileInput.value = '';
  },
  
  resetPreview() {
    this.uploadPreview.style.display = 'none';
    this.uploadPreview.src = '';
    this.uploadPlaceholder.style.display = 'block';
    this.dropZone.classList.remove('has-image');
  },
  
  setPreview(src) {
    this.uploadPreview.src = src;
    this.uploadPreview.style.display = 'block';
    this.uploadPlaceholder.style.display = 'none';
    this.dropZone.classList.add('has-image');
  },
  
  processFile(file) {
    if (!file.type.match('image.*')) {
      alert('Tolong upload file gambar (JPG/PNG).');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.resizeImage(e.target.result, 1200, 0.85).then(resizedUrl => {
        this.currentDataUrl = resizedUrl;
        this.setPreview(resizedUrl);
      });
    };
    reader.readAsDataURL(file);
  },
  
  resizeImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  },
  
  async save() {
    this.saveBtn.textContent = 'Menyimpan...';
    this.saveBtn.disabled = true;
    
    try {
      let finalUrl = this.urlInput.value;
      
      // If we have a new dataUrl from upload
      if (this.currentDataUrl) {
        // We no longer upload to ImgBB here. We just pass the base64 dataUrl back.
        // It will be handled and uploaded to GitHub when "Simpan ke GitHub" is clicked.
        finalUrl = this.currentDataUrl;
      }
      
      if (this.currentCallback) {
        this.currentCallback({
          imageUrl: finalUrl,
          imageCaption: this.captionInput.value,
          imageSize: this.sizeSelect.value,
          imagePosition: this.positionSelect.value
        });
      }
      
      this.hideModal();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      this.saveBtn.textContent = 'Simpan Gambar';
      this.saveBtn.disabled = false;
    }
  }
};
