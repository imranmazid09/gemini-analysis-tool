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

    // --- Event Listeners and Helper Functions ---
    textInput.addEventListener('input', () => { currentPosts = getPostsFromInput(textInput.value); updatePostCountDisplay(currentPosts.length); });
    fileUpload.addEventListener('change', handleFileUpload);
    analysisTypeRadios.forEach(radio => { radio.addEventListener('change', function () { updateControlPanels(); clearOutputSections(); outputArea.style.display = 'none'; }); });
    analyzeButton.addEventListener('click', performAnalysis);
    resetButton.addEventListener('click', resetTool);

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
    
    // --- NEW Two-Phase "Hybrid Stream-Report" Analysis Function ---
    async function performAnalysis() {
        currentPosts = getPostsFromInput(textInput.value);
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        
        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live results
        outputArea.style.display = 'block';
        showLoading('Initializing analysis...');
        
        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        
        let successfulResults = [];
        
        // --- PHASE 1: Resilient Post-by-Post Analysis ---
        for (let i = 0; i < postsToAnalyze.length; i++) {
            const postText = postsToAnalyze[i];
            showLoading(`Analyzing post ${i + 1} of ${postsToAnalyze.length}...`);
            
            const placeholderCard = renderPlaceholderCard(postText, i);
            summaryContentPlaceholder.appendChild(placeholderCard);
            summaryContentPlaceholder.scrollTop = summaryContentPlaceholder.scrollHeight;

            try {
                const response = await fetch('/.netlify/functions/gemini-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task: 'analyze_post', post: postText }),
                });
                if (!response.ok) throw new Error(`Server error (${response.status})`);
                
                const result = await response.json();
                if (!result || !result.sentiment || !result.justification) {
                    throw new Error("AI returned an invalid response.");
                }

                const finalResult = { text: postText, ...result };
                // Only add to successful results if the AI didn't flag it as failed
                if (finalResult.sentiment.toLowerCase() !== 'failed') {
                    successfulResults.push(finalResult);
                }
                updateCardWithResult(i, finalResult);

            } catch (error) {
                console.error(`Failed to analyze post ${i + 1}:`, error);
                updateCardWithError(i, error.message);
            }
        }
        
        // --- PHASE 2: AI-Powered Final Report Generation ---
        showLoading('AI is now generating the final report...');
        try {
            const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
            successfulResults.forEach(post => {
                let sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + post.sentiment.slice(1).toLowerCase();
                if (sentimentCounts.hasOwnProperty(sentiment)) { sentimentCounts[sentiment]++; }
            });

            // First, render the chart immediately with the data we have
            renderVisualization(sentimentCounts);
            
            // Then, ask the AI to write the reports based on a summary
            const reportData = {
                totalPosts: postsToAnalyze.length,
                successfulPosts: successfulResults.length,
                sentimentCounts: sentimentCounts
            };

            const reportResponse = await fetch('/.netlify/functions/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: 'generate_report', reportData: reportData }),
            });

            if (!reportResponse.ok) throw new Error("Could not generate final AI report.");

            const reportJson = await reportResponse.json();
            renderAIReports(reportJson);

        } catch (reportError) {
            console.error("Failed to generate final report:", reportError);
            interpretationPlaceholder.innerHTML = `<p class="error-message">Could not generate AI-powered insights for this analysis.</p>`;
            technicalReportContentPlaceholder.innerHTML = `<p class="error-message">Could not generate AI-powered technical report.</p>`;
        }
        
        hideLoading();
    }
    
    // --- Helper Rendering Functions ---
    function renderPlaceholderCard(postText, index) {
        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.id = `card-${index}`;
        card.innerHTML = `<blockquote class="post-text">"${postText}"</blockquote><p class="post-sentiment"><strong>Sentiment:</strong> <span class="spinner-inline"></span></p><p class="post-details"><strong>Justification:</strong> <span class="spinner-inline"></span></p>`;
        return card;
    }

    function updateCardWithResult(index, result) {
        const card = document.getElementById(`card-${index}`);
        if (!card) return;
        let sentiment = (result.sentiment || 'N/A').charAt(0).toUpperCase() + result.sentiment.slice(1).toLowerCase();
        const sentimentClass = sentiment.toLowerCase();
        card.className = `analysis-card card-${sentimentClass}`; // Reset classes and add the correct one
        card.querySelector('.post-sentiment').innerHTML = `<strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span>`;
        card.querySelector('.post-details').innerHTML = `<strong>Justification:</strong> ${result.justification || 'N/A'}`;
    }

    function updateCardWithError(index, errorMessage) {
        const card = document.getElementById(`card-${index}`);
        if (!card) return;
        card.className = 'analysis-card card-error';
        card.querySelector('.post-sentiment').innerHTML = `<strong>Sentiment:</strong> <span class="badge badge-error">Failed</span>`;
        card.querySelector('.post-details').innerHTML = `<strong>Error:</strong> ${errorMessage}`;
    }
    
    function renderVisualization(sentimentCounts) {
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
