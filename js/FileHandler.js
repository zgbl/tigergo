async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        //const sgfContent = await window.sgfAnalyzer.readFile(file);
        const sgfContent = await readFile(file);
        await window.sgfAnalyzer.parseSGF(sgfContent, file.name);
        window.sgfAnalyzer.analysisDisplay.addLogEntry(`文件 ${file.name} 上传成功`, 'success');

        // 启用分析按钮，确保停止按钮隐藏
        window.sgfAnalyzer.updateAnalysisButtons('idle');
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
        const file = files[0];
        if (file.name.endsWith('.sgf')) {
            const sgfContent = await window.sgfAnalyzer.readFile(file);
            await window.sgfAnalyzer.parseSGF(sgfContent, file.name);
        } else {
            window.sgfAnalyzer.analysisDisplay.addLogEntry('请选择 SGF 格式的文件', 'error');
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

// 🔹 挂到全局变量 window 上
window.handleFileUpload = handleFileUpload;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.readFile = readFile;