document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
    initializeDropZone();
    initializeTabs();
    initializeSuggestions();
 });
 
 function initializeUI() {
    hljs.highlightAll();
 }
 
 function initializeDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('csvFile');
 
    dropZone.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
 
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
 
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        });
    });
 
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        });
    });
 
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });
 
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
 }
 
 function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
 
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update panes
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `${targetTab}Tab`) {
                    pane.classList.add('active');
                }
            });
        });
    });
 }
 
 function initializeSuggestions() {
    const suggestions = document.querySelectorAll('.suggestion-chip');
    const promptInput = document.getElementById('prompt');
 
    suggestions.forEach(chip => {
        chip.addEventListener('click', () => {
            promptInput.value = chip.textContent.trim();
            promptInput.focus();
        });
    });
 }
 
 // File Handling
 async function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
        showError('Please upload a CSV file');
        return;
    }
 
    const formData = new FormData();
    formData.append('file', file);
    
    showLoading();
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateDataPreview(data.preview);
            updateDatasetInfo(data.statistics);
            showSuccess('File uploaded successfully');
            switchTab('preview');
            generateInitialInsights();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
 }
 
 // UI Updates
 function updateDataPreview(previewHtml) {
    const preview = document.getElementById('preview');
    
    // Wrap table dalam containers
    const wrappedHtml = `
        <div class="data-preview">
            <div class="data-preview-wrapper">
                <div class="table-container">
                    ${previewHtml}
                </div>
            </div>
        </div>
    `;
    
    preview.innerHTML = wrappedHtml;

    // Pastikan lebar kolom konsisten
    const table = preview.querySelector('table');
    const headers = table.querySelectorAll('th');
    const totalWidth = table.offsetWidth;
    const columnWidth = Math.min(200, totalWidth / headers.length);

    headers.forEach(header => {
        header.style.width = `${columnWidth}px`;
    });
}
 
 function updateDatasetInfo(stats) {
    const datasetInfo = document.getElementById('datasetStats');
    datasetInfo.innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <i class="fas fa-hashtag"></i>
                <div class="info-text">
                    <label>Numeric Columns</label>
                    <span>${stats.numeric_columns.length}</span>
                </div>
            </div>
            <div class="info-item">
                <i class="fas fa-font"></i>
                <div class="info-text">
                    <label>Categorical Columns</label>
                    <span>${stats.categorical_columns.length}</span>
                </div>
            </div>
            <div class="info-list">
                <h4>Missing Values</h4>
                <ul>
                    ${Object.entries(stats.missing_values)
                        .map(([col, count]) => `
                            <li class="${count > 0 ? 'has-missing' : 'complete'}">
                                <span class="col-name">${col}</span>
                                <span class="missing-count">${count}</span>
                            </li>
                        `).join('')}
                </ul>
            </div>
        </div>
    `;
 }

 function downloadPlot(button, timestamp) {
    const img = button.closest('.plot-container').querySelector('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Create new image to handle the download
    const image = new Image();
    image.onload = function() {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        
        const link = document.createElement('a');
        link.download = `plot_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    image.src = img.src;
}
 
 // Analysis Processing
 async function processPrompt() {
    const prompt = document.getElementById('prompt').value;
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    
    if (!prompt.trim()) {
        showError('Please enter a query');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: prompt })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'analysis-container';
            
            // Add controls
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'analysis-controls';
            controlsDiv.innerHTML = `
                <button onclick="toggleThinking(this)" class="action-btn">
                    <i class="fas fa-brain"></i> Show Thinking
                </button>
                <button onclick="toggleCode(this)" class="action-btn">
                    <i class="fas fa-code"></i> Show Code
                </button>
            `;
            resultDiv.appendChild(controlsDiv);
            
            // Add thinking section
            if (data.thinking) {
                const thinkingDiv = document.createElement('div');
                thinkingDiv.className = 'thinking-section';
                thinkingDiv.style.display = 'none';
                thinkingDiv.innerHTML = `
                    <h4><i class="fas fa-lightbulb"></i> Analysis Approach:</h4>
                    <div class="thinking-text">${data.thinking}</div>
                `;
                resultDiv.appendChild(thinkingDiv);
            }
            
            // Add code section
            if (data.code) {
                const codeDiv = document.createElement('div');
                codeDiv.className = 'code-section';
                codeDiv.style.display = 'none';
                codeDiv.innerHTML = `
                    <pre><code class="language-python">${data.code}</code></pre>
                `;
                resultDiv.appendChild(codeDiv);
            }
            
            // Add output section
            if (data.output) {
                let currentTextGroup = null;
                
                data.output.forEach((item) => {
                    if (item.type === 'text') {
                        if (!currentTextGroup) {
                            currentTextGroup = document.createElement('div');
                            currentTextGroup.className = 'output-text';
                        }
                        currentTextGroup.innerHTML += item.content + '\n';
                    } else if (item.type === 'plot') {
                        if (currentTextGroup) {
                            resultDiv.appendChild(currentTextGroup);
                            currentTextGroup = null;
                        }
                        
                        const plotDiv = document.createElement('div');
                        plotDiv.className = 'output-plot';
                        const timestamp = new Date().getTime();
                        plotDiv.innerHTML = `
                            <div class="plot-container">
                                <img src="data:image/png;base64,${item.content}" 
                                     alt="Data visualization"
                                     onload="this.style.opacity='1'">
                                <div class="plot-controls">
                                    <button onclick="downloadPlot(this, '${timestamp}')" class="plot-btn">
                                        <i class="fas fa-download"></i> Download
                                    </button>
                                </div>
                            </div>
                        `;
                        resultDiv.appendChild(plotDiv);
                    } else if (item.type === 'table') {
                        if (currentTextGroup) {
                            resultDiv.appendChild(currentTextGroup);
                            currentTextGroup = null;
                        }
                        
                        const tableDiv = document.createElement('div');
                        tableDiv.className = 'output-table';
                        tableDiv.innerHTML = item.content;
                        resultDiv.appendChild(tableDiv);
                    }
                });
                
                if (currentTextGroup) {
                    resultDiv.appendChild(currentTextGroup);
                }
            }
            
            // Add error if any
            if (data.error) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    ${data.error}
                `;
                resultDiv.appendChild(errorDiv);
            }
            
            result.insertBefore(resultDiv, result.firstChild);
            hljs.highlightAll();
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch (error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            Error: ${error.message}
        `;
        result.insertBefore(errorDiv, result.firstChild);
    } finally {
        loading.style.display = 'none';
    }
}
 
 // Toggle Functions
 function toggleThinking(button) {
    const container = button.closest('.analysis-container');
    const thinkingContent = container.querySelector('.thinking-section');
    if (thinkingContent) {
        const isHidden = thinkingContent.style.display === 'none';
        thinkingContent.style.display = isHidden ? 'block' : 'none';
        thinkingContent.style.opacity = '0';
        
        if (isHidden) {
            setTimeout(() => {
                thinkingContent.style.transition = 'opacity 0.3s ease';
                thinkingContent.style.opacity = '1';
            }, 10);
        }
        
        button.innerHTML = isHidden ? 
            '<i class="fas fa-brain"></i> Hide Thinking' : 
            '<i class="fas fa-brain"></i> Show Thinking';
    }
 }
 
 function toggleCode(button) {
    const container = button.closest('.analysis-container');
    const codeContent = container.querySelector('.code-section');
    if (codeContent) {
        const isHidden = codeContent.style.display === 'none';
        codeContent.style.display = isHidden ? 'block' : 'none';
        codeContent.style.opacity = '0';
        
        if (isHidden) {
            setTimeout(() => {
                codeContent.style.transition = 'opacity 0.3s ease';
                codeContent.style.opacity = '1';
                container.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }, 10);
        }
        
        button.innerHTML = isHidden ? 
            '<i class="fas fa-code"></i> Hide Code' : 
            '<i class="fas fa-code"></i> Show Code';
    }
 }
 
 // Utility Functions
 function showLoading() {
    document.getElementById('loading').style.display = 'block';
 }
 
 function hideLoading() {
    document.getElementById('loading').style.display = 'none';
 }
 
 function showError(message) {
    // TODO: Implement toast notification
    console.error(message);
 }
 
 function showSuccess(message) {
    // TODO: Implement toast notification
    console.log(message);
 }
 
 function switchTab(tabId) {
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).click();
 }
 
 function generateInitialInsights() {
    // TODO: Implement auto insights generation
    console.log('Generating initial insights...');
 }