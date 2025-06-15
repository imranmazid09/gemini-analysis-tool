document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const textInput = document.getElementById('textInput');
    const fileUpload = document.getElementById('fileUpload');
    const postCountInfo = document.getElementById('postCountInfo');
    const analysisTypeRadios = document.querySelectorAll('input[name="analysisType"]');
    const analyzeButton = document.getElementById('analyzeButton');
    const resetButton = document.getElementById('resetButton');

    const controlsSentiment = document.getElementById('controlsSentiment');
    const controlsNetwork = document.getElementById('controlsNetwork');
    const controlsTopic = document.getElementById('controlsTopic');

    const outputArea = document.getElementById('outputArea');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const activeAnalysisTitle = document.getElementById('activeAnalysisTitle');
    const summaryContentPlaceholder = document.getElementById('summaryContentPlaceholder');
    const visualizationPlaceholder = document.getElementById('visualizationPlaceholder');
    const interpretationPlaceholder = document.getElementById('interpretationPlaceholder');
    const associatedPostsContainer = document.getElementById('networkAssociatedPosts');
    const associatedPostsPlaceholder = document.getElementById('associatedPostsPlaceholder');
    const technicalReportContentPlaceholder = document.getElementById('technicalReportContentPlaceholder');

    const networkNumNodesInput = document.getElementById('networkNumNodes');
    const networkMinCooccurrenceInput = document.getElementById('networkMinCooccurrence');
    const topicNumTopicsSelect = document.getElementById('topicNumTopics');
    const topicWordsPerTopicInput = document.getElementById('topicWordsPerTopic');

    let currentAnalysisType = 'sentiment';
    let sentimentChartInstance = null;
    let topicChartInstance = null;
    const MAX_POSTS = 500;
    let currentPosts = []; 

    // --- Global Variables ---
    const CLUSTER_COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#C9CBCF", "#FDB45C", "#4D5360", "#E040FB", "#80CBC4", "#FFAB91", "#B39DDB", "#A5D6A7", "#FFF59D"];


    // --- Event Listeners ---
    textInput.addEventListener('input', () => {
        currentPosts = getPostsFromInput(textInput.value);
        updatePostCountDisplay(currentPosts.length);
    });
    fileUpload.addEventListener('change', handleFileUpload);

    analysisTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            currentAnalysisType = this.value;
            updateControlPanels();
            clearOutputSections();
            outputArea.style.display = 'none';
        });
    });

    analyzeButton.addEventListener('click', performAnalysis);
    resetButton.addEventListener('click', resetTool);

    // --- Core Functions ---

    function getPostsFromInput(rawText) {
        let posts;
        if (rawText.includes('\n\n') || rawText.includes('\r\n\r\n')) { 
            posts = rawText.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p !== '');
        } else { 
            posts = rawText.split(/\n|\r\n/).map(p => p.trim()).filter(p => p !== '');
        }
        return posts;
    }

    function updatePostCountDisplay(count) {
        postCountInfo.textContent = `Posts detected: ${count}`;
        if (count > MAX_POSTS) {
            postCountInfo.textContent += ` (Warning: Using first ${MAX_POSTS} posts due to limit.)`;
            postCountInfo.style.color = 'red';
        } else if (count === 1 && textInput.value.trim() !== "" && !textInput.value.includes('\n\n') && !textInput.value.includes('\n')) {
             postCountInfo.textContent = `Posts detected: 1 (Note: If this is a single multi-line post not separated by blank lines from others in a .txt file, it will be treated as one post. For CSV, ensure multi-line posts are properly quoted.)`;
             postCountInfo.style.color = '#555';
        } else {
            postCountInfo.style.color = '#555';
        }
    }
    
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        showLoading("Reading file...");
        try {
            const rawFileContent = await readFileAsText(file);

            if (file.name.endsWith('.csv')) {
                Papa.parse(rawFileContent, {
                    skipEmptyLines: true, 
                    complete: function(results) {
                        let parsedCsvPosts = [];
                        if (results.data) {
                            results.data.forEach(row => {
                                if (row.length > 0 && row[0] !== null && row[0] !== undefined) {
                                    parsedCsvPosts.push(String(row[0]).trim());
                                }
                            });
                        }
                        parsedCsvPosts = parsedCsvPosts.filter(post => post !== ""); 

                        currentPosts = parsedCsvPosts; 

                        if (currentPosts.length === 1 && currentPosts[0].includes('\n') && !currentPosts[0].includes('\n\n')) {
                            textInput.value = currentPosts[0].trimEnd() + '\n\n';
                        } else {
                            textInput.value = currentPosts.join('\n\n');
                        }
                        
                        updatePostCountDisplay(currentPosts.length);
                        hideLoading();
                    },
                    error: function(error, fileObj) {
                        console.error("PapaParse Error:", error, fileObj);
                        alert("Error parsing CSV file. Please ensure it's a valid CSV. Check console for details.");
                        textInput.value = ""; 
                        currentPosts = [];
                        updatePostCountDisplay(0);
                        hideLoading();
                    }
                });
            } else { 
                textInput.value = rawFileContent;
                currentPosts = getPostsFromInput(textInput.value); 
                updatePostCountDisplay(currentPosts.length);
                hideLoading(); 
            }
        } catch (error) {
            alert("Error reading file. Please ensure it's a valid .txt or .csv file and encoded in UTF-8.");
            console.error("File Read Error:", error);
            textInput.value = ""; 
            currentPosts = [];
            updatePostCountDisplay(0);
            hideLoading();
        }
    }
    
    function updateControlPanels() {
        controlsSentiment.classList.remove('active');
        controlsNetwork.classList.remove('active');
        controlsTopic.classList.remove('active');
        const selectedType = document.querySelector('input[name="analysisType"]:checked').value;
        document.getElementById(`controls${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`).classList.add('active');
    }

    function clearOutputSections() {
        summaryContentPlaceholder.innerHTML = '<p>Summary of the analysis will appear here...</p>';
        visualizationPlaceholder.innerHTML = '<p>Data visualization will appear here...</p>';
        interpretationPlaceholder.innerHTML = '<p>Interpretation of results and example strategic insights will appear here...</p>';
        associatedPostsContainer.style.display = 'none';
        associatedPostsPlaceholder.innerHTML = '<p>Posts related to selected network nodes/edges or topics will appear here...</p>';
        technicalReportContentPlaceholder.innerHTML = `
            <h4>Computational Techniques Used:</h4>
            <p>Details about the specific algorithms or methods used will appear here.</p>
            <h4>Process of Data Analysis (Simplified for Reporting):</h4>
            <p>A non-technical explanation of the data analysis steps will appear here.</p>
        `;
        if (sentimentChartInstance) sentimentChartInstance.destroy();
        if (topicChartInstance) topicChartInstance.destroy();
        sentimentChartInstance = null;
        topicChartInstance = null;
    }
    
    function showLoading(message = "Analyzing your text, please wait...") {
        loadingIndicator.querySelector('p').textContent = message;
        loadingIndicator.style.display = 'block';
        outputArea.style.display = 'none'; 
        analyzeButton.disabled = true;
        resetButton.disabled = true;
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
        analyzeButton.disabled = false;
        resetButton.disabled = false;
    }

    function resetTool() {
        textInput.value = '';
        fileUpload.value = ''; 
        outputArea.style.display = 'none';
        clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentAnalysisType = 'sentiment';
        updateControlPanels();
        currentPosts = [];
        updatePostCountDisplay(0);
    }

    async function performAnalysis() {
        if (currentPosts.length === 0) {
            alert("Please paste or upload some text to analyze.");
            return;
        }
        
        let postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        
        clearOutputSections(); 
        showLoading();
        outputArea.style.display = 'block'; 
    
        const selectedRadio = document.querySelector('input[name="analysisType"]:checked');
        const analysisTitle = selectedRadio ? selectedRadio.parentElement.textContent.trim() : "Analysis";
        activeAnalysisTitle.textContent = analysisTitle;
    
        // This is the new part that calls our secure gateway function
        try {
            const response = await fetch('/.netlify/functions/gemini-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    posts: postsToAnalyze,
                    analysisType: currentAnalysisType,
                    // We can add specific options here later
                    options: {} 
                }),
            });
    
            if (!response.ok) {
                // If the server response is not good, show an error
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
    
            const resultText = await response.text();
            // The response from Gemini might be a JSON string, so we try to parse it.
            try {
                const resultJson = JSON.parse(resultText);
                summaryContentPlaceholder.innerHTML = `<pre>${JSON.stringify(resultJson, null, 2)}</pre>`;
            } catch (e) {
                // If it's not JSON, just display the raw text
                summaryContentPlaceholder.innerHTML = `<p>${resultText}</p>`;
            }
            
            // For now, we'll leave these sections blank
            visualizationPlaceholder.innerHTML = '<p>Visualization will be generated based on AI results in a future step.</p>';
            interpretationPlaceholder.innerHTML = '<p>Custom interpretation will be generated based on AI results in a future step.</p>';
            technicalReportContentPlaceholder.innerHTML = `
                <h4>Computational Techniques Used:</h4>
                <p>The analysis was performed by making a secure call to the Google Gemini API. The front-end sent the text data to a secure serverless function, which then forwarded the request to the AI model.</p>
                <h4>Process of Data Analysis (Simplified for Reporting):</h4>
                <ol>
                    <li>The ${postsToAnalyze.length} social media posts were sent to a secure server-side function.</li>
                    <li>The function called the Google Gemini 1.5 Flash model with a prompt to perform the requested analysis.</li>
                    <li>The AI's response was captured and displayed directly in the results summary.</li>
                </ol>`;
    
        } catch (error) {
            console.error("Analysis Error:", error);
            summaryContentPlaceholder.innerHTML = `<p style="color:red;">An error occurred during analysis: ${error.message}. Check the console for details.</p>`;
        } finally {
            hideLoading();
        }
    }

    updateControlPanels();
    updatePostCountDisplay(0);
});