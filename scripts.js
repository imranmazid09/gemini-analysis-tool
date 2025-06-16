document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const textInput = document.getElementById('textInput');
    const fileUpload = document.getElementById('fileUpload');
    const postCountInfo = document.getElementById('postCountInfo');
    const analysisTypeRadios = document.querySelectorAll('input[name="analysisType"]');
    const analyzeButton = document.getElementById('analyzeButton');
    const resetButton = document.getElementById('resetButton');
    const controlsSentiment = document.getElementById('controlsSentiment');
    const outputArea = document.getElementById('outputArea');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const activeAnalysisTitle = document.getElementById('activeAnalysisTitle');
    const summaryContentPlaceholder = document.getElementById('summaryContentPlaceholder');
    const visualizationPlaceholder = document.getElementById('visualizationPlaceholder');
    const interpretationPlaceholder = document.getElementById('interpretationPlaceholder');
    const technicalReportContentPlaceholder = document.getElementById('technicalReportContentPlaceholder');

    let sentimentChartInstance = null;
    const MAX_POSTS = 500;
    let currentPosts = [];

    // --- Event Listeners ---
    textInput.addEventListener('input', () => { currentPosts = getPostsFromInput(textInput.value); updatePostCountDisplay(currentPosts.length); });
    fileUpload.addEventListener('change', handleFileUpload);
    analysisTypeRadios.forEach(radio => { radio.addEventListener('change', function () { updateControlPanels(); clearOutputSections(); outputArea.style.display = 'none'; }); });
    analyzeButton.addEventListener('click', performAnalysis);
    resetButton.addEventListener('click', resetTool);

    // --- Core Helper Functions ---
    function getPostsFromInput(rawText) {
        let posts;
        if (rawText.includes('\n\n') || rawText.includes('\r\n\r\n')) { posts = rawText.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p !== ''); } 
        else { posts = rawText.split(/\n|\r\n/).map(p => p.trim()).filter(p => p !== ''); }
        return posts;
    }
    function updatePostCountDisplay(count) {
        postCountInfo.textContent = `Posts detected: ${count}`;
        postCountInfo.style.color = count > MAX_POSTS ? 'red' : '#555';
        if (count > MAX_POSTS) { postCountInfo.textContent += ` (Warning: Using first ${MAX_POSTS} posts due to limit.)`; }
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
        const file = event.target.files[0]; if (!file) return;
        showLoading('Reading file...');
        try {
            const rawFileContent = await readFileAsText(file);
            textInput.value = rawFileContent;
            currentPosts = getPostsFromInput(textInput.value);
            updatePostCountDisplay(currentPosts.length);
        } catch (error) {
            alert("Error reading file."); console.error("File Read Error:", error);
        } finally {
            hideLoading();
        }
    }
    function updateControlPanels() {
        document.querySelectorAll('.analysis-controls').forEach(el => el.classList.remove('active'));
        const selectedType = document.querySelector('input[name="analysisType"]:checked').value;
        document.getElementById(`controls${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`).classList.add('active');
    }
    function clearOutputSections() {
        summaryContentPlaceholder.innerHTML = '<p>Summary of the analysis will appear here...</p>';
        visualizationPlaceholder.innerHTML = '';
        interpretationPlaceholder.innerHTML = '';
        technicalReportContentPlaceholder.innerHTML = '';
        if (sentimentChartInstance) { sentimentChartInstance.destroy(); sentimentChartInstance = null; }
    }
    function showLoading(message) { 
        loadingIndicator.querySelector('p').textContent = message;
        analyzeButton.disabled = true; 
        resetButton.disabled = true; 
        loadingIndicator.style.display = 'block'; 
    }
    function hideLoading() { analyzeButton.disabled = false; resetButton.disabled = false; loadingIndicator.style.display = 'none';}
    function resetTool() {
        textInput.value = ''; fileUpload.value = '';
        outputArea.style.display = 'none'; clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentPosts = []; updatePostCountDisplay(0);
    }
    
    // --- NEW Single-Call Analysis Function ---
    async function performAnalysis() {
        currentPosts = getPostsFromInput(textInput.value);
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        
        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live results
        outputArea.style.display = 'block';
        showLoading('AI research assistant is analyzing your data and preparing a full report...');
        
        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        
        try {
            const response = await fetch('/.netlify/functions/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posts: postsToAnalyze }),
            });

            if (!response.ok) {
                throw new Error(`The server returned an error (${response.status}).`);
            }
            
            const resultText = await response.text();
            let jsonString = resultText;
            const markdownMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (markdownMatch && markdownMatch[1]) {
                jsonString = markdownMatch[1];
            } else {
                const jsonStartIndex = jsonString.indexOf('{');
                const jsonEndIndex = jsonString.lastIndexOf('}');
                if (jsonStartIndex === -1 || jsonEndIndex === -1) {
                    throw new Error("The AI provided an invalid, non-JSON response.");
                }
                jsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
            }
            
            const resultJson = JSON.parse(jsonString);

            // --- Render All Report Sections from the Single Response ---
            renderPostAnalysis(resultJson);
            renderVisualization(resultJson);
            renderAIReports(resultJson);

        } catch (error) {
            console.error("Analysis Error:", error);
            summaryContentPlaceholder.innerHTML = `<p class="error-message">An error occurred during analysis: ${error.message}</p>`;
        } finally {
            hideLoading();
        }
    }
    
    // --- Helper Rendering Functions ---
    function renderPostAnalysis(resultJson) {
        summaryContentPlaceholder.innerHTML = ''; // Clear placeholder
        if (!resultJson.post_analysis || !Array.isArray(resultJson.post_analysis)) {
            summaryContentPlaceholder.innerHTML = `<p class="error-message">AI response was missing the post-by-post analysis.</p>`;
            return;
        }
        
        let htmlOutput = '';
        resultJson.post_analysis.forEach(post => {
            const sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + (post.sentiment || 'N/A').slice(1).toLowerCase();
            const sentimentClass = sentiment.toLowerCase();
            htmlOutput += `
                <div class="analysis-card card-${sentimentClass}">
                    <blockquote class="post-text">"${post.text}"</blockquote>
                    <p class="post-sentiment"><strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span></p>
                    <p class="post-details"><strong>Justification:</strong> ${post.justification || 'N/A'}</p>
                </div>
            `;
        });
        summaryContentPlaceholder.innerHTML = htmlOutput;
    }

    function renderVisualization(resultJson) {
        if (!resultJson.post_analysis) {
             visualizationPlaceholder.innerHTML = `<p class="error-message">Could not generate chart as post analysis was missing.</p>`;
             return;
        }
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
        resultJson.post_analysis.forEach(post => {
            let sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + post.sentiment.slice(1).toLowerCase();
            if (sentimentCounts.hasOwnProperty(sentiment)) { sentimentCounts[sentiment]++; }
        });

        visualizationPlaceholder.innerHTML = '<canvas id="sentimentChart"></canvas>';
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        if (sentimentChartInstance) sentimentChartInstance.destroy();
        sentimentChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: ['Positive', 'Negative', 'Neutral', 'Mixed'], datasets: [{ label: 'Number of Posts', data: [sentimentCounts.Positive, sentimentCounts.Negative, sentimentCounts.Neutral, sentimentCounts.Mixed], backgroundColor: ['#28a745', '#dc3545', '#6c757d', '#ffc107'] }] },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Final Sentiment Distribution' } } }
        });
    }

    function renderAIReports(reportJson) {
        // Render Interpretation & Strategic Insights
        if (reportJson.strategic_insights) {
            const insights = reportJson.strategic_insights;
            let insightsHTML = `
                <p><strong>What these results mean</strong></p>
                <p>${insights.summary || 'Summary not provided.'}</p>
                <p><strong>Example Strategic Insights</strong></p>
                <ul>
                    ${(insights.insights_list || []).map(item => `<li>${item}</li>`).join('')}
                </ul>`;
            interpretationPlaceholder.innerHTML = insightsHTML;
        } else {
            interpretationPlaceholder.innerHTML = "<p class='error-message'>AI-powered insights were not found in the response.</p>";
        }

        // Render Technical Report
        if (reportJson.technical_explanation) {
            const tech = reportJson.technical_explanation;
            let techHTML = `
                <h4>Computational Techniques Used:</h4>
                <p>${tech.computational_techniques || 'Details not provided.'}</p>
                <h4>Process of Data Analysis (Simplified for Reporting):</h4>
                <ol>
                    ${(tech.data_analysis_process || []).map(item => `<li>${item}</li>`).join('')}
                </ol>`;
            technicalReportContentPlaceholder.innerHTML = techHTML;
        } else {
             technicalReportContentPlaceholder.innerHTML = "<p class='error-message'>AI-powered technical explanation was not found in the response.</p>";
        }
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
