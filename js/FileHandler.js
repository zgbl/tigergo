async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
        window.sgfAnalyzer.analysisDisplay.addLogEntry(`准备导入 ${files.length} 个文件...`, 'info');

        for (let i = 0; i < files.length; i++) {
            await window.sgfAnalyzer.addToBatchQueue(files[i]);
        }

    } catch (error) {
        console.error('文件上传失败:', error);
        window.sgfAnalyzer.analysisDisplay.addLogEntry(`文件上传失败: ${error.message}`, 'error');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

async function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        window.sgfAnalyzer.analysisDisplay.addLogEntry(`拖入 ${files.length} 个文件...`, 'info');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filename = file.name.toLowerCase();

            if (filename.endsWith('.sgf') || filename.endsWith('.gib')) {
                await window.sgfAnalyzer.addToBatchQueue(file);
            } else {
                window.sgfAnalyzer.analysisDisplay.addLogEntry(`跳过不受支持的文件: ${file.name}`, 'warning');
            }
        }
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('文件解析失败'));
        reader.readAsArrayBuffer(file);
    });
}

// 🔹 挂到全局变量 window 上
window.handleFileUpload = handleFileUpload;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.readFile = readFile;
window.readFileAsArrayBuffer = readFileAsArrayBuffer;