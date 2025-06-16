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
    const MAX_POSTS = 500;
    let currentPosts = []; 

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
                        textInput.value = currentPosts.join('\n\n');
                        
                        updatePostCountDisplay(currentPosts.length);
                        hideLoading();
                    },
                    error: function(error) {
                        console.error("PapaParse Error:", error);
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
        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
            sentimentChartInstance = null;
        }
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
        showLoading("AI research assistant is analyzing your data...");
        outputArea.style.display = 'block'; 
    
        const selectedRadio = document.querySelector('input[name="analysisType"]:checked');
        const analysisTitle = selectedRadio ? selectedRadio.parentElement.textContent.trim() : "Analysis";
        activeAnalysisTitle.textContent = analysisTitle;
    
        try {
            const response = await fetch('/.netlify/functions/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posts: postsToAnalyze }),
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
    
            let resultText = await response.text();
            
            let jsonString = resultText;
            const markdownMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (markdownMatch && markdownMatch[1]) {
                jsonString = markdownMatch[1];
            } else {
                const jsonStartIndex = jsonString.indexOf('{');
                const jsonEndIndex = jsonString.lastIndexOf('}');
                if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                    jsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
                } else {
                    throw new Error("Could not find a valid JSON object in the AI's response.");
                }
            }
            
            const resultJson = JSON.parse(jsonString);
    
            // --- 1. Populate Post-by-Post Analysis ---
            let htmlOutput = '';
            const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
            let analyzedPostsCount = 0;

            if (resultJson.post_analysis && Array.isArray(resultJson.post_analysis)) {
                analyzedPostsCount = resultJson.post_analysis.length;
                resultJson.post_analysis.forEach(post => {
                    let sentiment = post.sentiment || 'N/A';
                    sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
                    if (sentimentCounts.hasOwnProperty(sentiment)) {
                        sentimentCounts[sentiment]++;
                    }
                    const sentimentClass = sentiment.toLowerCase();
                    htmlOutput += `
                        <div class="analysis-card card-${sentimentClass}">
                            <blockquote class="post-text">"${post.text}"</blockquote>
                            <p class="post-sentiment"><strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span></p>
                            <p class="post-details"><strong>Justification:</strong> ${post.justification || 'N/A'}</p>
                        </div>
                    `;
                });
            } else {
                htmlOutput = '<p>The AI response did not contain post-by-post analysis.</p>';
            }
            summaryContentPlaceholder.innerHTML = htmlOutput;
            
            // --- 2. Generate the Visualization ---
            visualizationPlaceholder.innerHTML = '<canvas id="sentimentChart"></canvas>';
            const ctx = document.getElementById('sentimentChart').getContext('2d');
            if (sentimentChartInstance) sentimentChartInstance.destroy();
            sentimentChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Positive', 'Negative', 'Neutral', 'Mixed'],
                    datasets: [{
                        label: 'Number of Posts',
                        data: [
                            sentimentCounts.Positive,
                            sentimentCounts.Negative,
                            sentimentCounts.Neutral,
                            sentimentCounts.Mixed
                        ],
                        backgroundColor: ['#28a745', '#dc3545', '#6c757d', '#ffc107'],
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                    responsive: true,
                    plugins: { legend: { display: false }, title: { display: true, text: 'Sentiment Distribution' } }
                }
            });
    
            // --- 3. Populate AI-Driven Interpretation & Insights ---
            if (resultJson.strategic_insights) {
                const insights = resultJson.strategic_insights;
                let insightsHTML = `
                    <p><strong>What these results mean</strong></p>
                    <p>${insights.summary || 'Summary not provided.'}</p>
                    <p><strong>Example Strategic Insights</strong></p>
                    <ul>
                        ${(insights.insights_list || []).map(item => `<li>${item}</li>`).join('')}
                    </ul>`;
                interpretationPlaceholder.innerHTML = insightsHTML;
            } else {
                interpretationPlaceholder.innerHTML = "<p>AI-powered insights were not found in the response.</p>";
            }

            // --- 4. Update Technical Report ---
            technicalReportContentPlaceholder.innerHTML = `
                <h4>Computational Techniques Used:</h4>
                <p>The analysis was performed by making a single, secure API call to the Google Gemini model. The model was instructed to return a comprehensive report including post-by-post analysis and strategic insights in a single JSON object.</p>
                <h4>Process of Data Analysis (Simplified for Reporting):</h4>
                <ol>
                    <li>The ${analyzedPostsCount} social media posts were sent to the Google Gemini API.</li>
                    <li>The AI analyzed each post for its emotional tone and provided a justification for its classification.</li>
                    <li>The AI also generated a summary and strategic insights based on the overall sentiment distribution.</li>
                    <li>The structured JSON response was then parsed and used to populate all sections of this report.</li>
                </ol>`;
    
        } catch (error) {
            console.error("Analysis Error:", error);
            summaryContentPlaceholder.innerHTML = `<p style="color:red;">An error occurred during analysis: ${error.message}. Check the console for details.</p>`;
        } finally {
            hideLoading();
        }
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
