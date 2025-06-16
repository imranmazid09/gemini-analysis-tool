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
    const loadingIndicator = document.getElementById('loadingIndicator'); // We will still use this for the overall state
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

    // --- NEW: Live Log Function ---
    function logToScreen(message, type = 'info') {
        const logEntry = document.createElement('p');
        logEntry.textContent = message;
        logEntry.className = `log-message log-${type}`; // e.g., log-info, log-success, log-error
        summaryContentPlaceholder.appendChild(logEntry);
        summaryContentPlaceholder.scrollTop = summaryContentPlaceholder.scrollHeight; // Auto-scroll to bottom
    }

    // --- Core Functions (Unchanged) ---
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
        showLoading("Reading file...");
        try {
            const rawFileContent = await readFileAsText(file);
            if (file.name.endsWith('.csv')) {
                Papa.parse(rawFileContent, {
                    skipEmptyLines: true,
                    complete: function (results) {
                        let parsedCsvPosts = [];
                        if (results.data) { results.data.forEach(row => { if (row.length > 0 && row[0] !== null && row[0] !== undefined) { parsedCsvPosts.push(String(row[0]).trim()); } }); }
                        parsedCsvPosts = parsedCsvPosts.filter(post => post !== "");
                        currentPosts = parsedCsvPosts;
                        textInput.value = currentPosts.join('\n\n');
                        updatePostCountDisplay(currentPosts.length);
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
            alert("Error reading file."); console.error("File Read Error:", error);
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
        visualizationPlaceholder.innerHTML = '<p>Data visualization will appear here...</p>';
        interpretationPlaceholder.innerHTML = '<p>Interpretation of results and example strategic insights will appear here...</p>';
        if (sentimentChartInstance) { sentimentChartInstance.destroy(); sentimentChartInstance = null; }
    }
    function showLoading(message) { analyzeButton.disabled = true; resetButton.disabled = true; }
    function hideLoading() { analyzeButton.disabled = false; resetButton.disabled = false; }
    function resetTool() {
        textInput.value = ''; fileUpload.value = '';
        outputArea.style.display = 'none'; clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentPosts = []; updatePostCountDisplay(0);
    }
    
    // --- NEW Live Log Analysis Function ---
    async function performAnalysis() {
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        const BATCH_SIZE = 25;
        const batches = [];
        for (let i = 0; i < postsToAnalyze.length; i += BATCH_SIZE) {
            batches.push(postsToAnalyze.slice(i, i + BATCH_SIZE));
        }

        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live log
        outputArea.style.display = 'block';
        showLoading();

        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        logToScreen(`Initializing ${analysisTitle}...`);
        logToScreen(`Found ${postsToAnalyze.length} posts. Processing in ${batches.length} batch(es) of ${BATCH_SIZE}.`);

        let allResults = [];
        
        for (let i = 0; i < batches.length; i++) {
            logToScreen(`-----------------------------------\nAnalyzing batch ${i + 1} of ${batches.length}...`, 'info');
            try {
                const response = await fetch('/.netlify/functions/gemini-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ posts: batches[i] }),
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status ${response.status}.`);
                }

                let resultText = await response.text();
                let jsonString = resultText;
                const markdownMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
                if (markdownMatch && markdownMatch[1]) { jsonString = markdownMatch[1]; } 
                else {
                    const jsonStartIndex = jsonString.indexOf('{');
                    const jsonEndIndex = jsonString.lastIndexOf('}');
                    if (jsonStartIndex === -1 || jsonEndIndex === -1) { throw new Error("The AI provided an invalid, non-JSON response."); }
                    jsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
                }
                
                const resultJson = JSON.parse(jsonString);
                if (resultJson.post_analysis && Array.isArray(resultJson.post_analysis)) {
                    allResults.push(...resultJson.post_analysis);
                    logToScreen(`✓ Success: Batch ${i + 1} analyzed.`, 'success');
                } else {
                    throw new Error("The AI response was missing the expected 'post_analysis' data.");
                }
            } catch (error) {
                logToScreen(`✗ ERROR on batch ${i + 1}: ${error.message}. Analysis halted.`, 'error');
                hideLoading(); // Stop the process
                return; // Exit the function
            }
        }
        
        logToScreen(`-----------------------------------\n✓ All batches complete. Finalizing report...`, 'success');
        renderFinalReport(allResults);
        hideLoading();
    }
    
    // --- NEW: Function to render the final report ---
    function renderFinalReport(allResults) {
        // Step 1: Render the cards (replaces the log)
        summaryContentPlaceholder.innerHTML = ''; // Clear the log
        let htmlOutput = '';
        allResults.forEach(post => {
            let sentiment = post.sentiment || 'N/A';
            sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
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

        // Step 2: Render the visualization and other sections
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
        allResults.forEach(post => {
            let sentiment = post.sentiment || 'N/A';
            sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
            if (sentimentCounts.hasOwnProperty(sentiment)) { sentimentCounts[sentiment]++; }
        });

        renderVisualization(sentimentCounts);
        renderInterpretation(sentimentCounts, allResults.length);
        renderTechnicalReport(allResults.length);
    }
    
    // --- Helper rendering functions (Mostly unchanged) ---
    function renderVisualization(sentimentCounts) {
        visualizationPlaceholder.innerHTML = '<canvas id="sentimentChart"></canvas>';
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        if (sentimentChartInstance) sentimentChartInstance.destroy();
        sentimentChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: ['Positive', 'Negative', 'Neutral', 'Mixed'], datasets: [{ label: 'Number of Posts', data: [sentimentCounts.Positive, sentimentCounts.Negative, sentimentCounts.Neutral, sentimentCounts.Mixed], backgroundColor: ['#28a745', '#dc3545', '#6c757d', '#ffc107'] }] },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Final Sentiment Distribution' } } }
        });
    }
    function renderInterpretation(sentimentCounts, analyzedPostsCount) {
        if (analyzedPostsCount === 0) { interpretationPlaceholder.innerHTML = "<p>No posts were successfully analyzed.</p>"; return; }
        const positivePercent = ((sentimentCounts.Positive / analyzedPostsCount) * 100).toFixed(1);
        const negativePercent = ((sentimentCounts.Negative / analyzedPostsCount) * 100).toFixed(1);
        interpretationPlaceholder.innerHTML = `<p><strong>What these results mean</strong></p><p>The analysis of ${analyzedPostsCount} posts shows the conversation is ${positivePercent}% positive and ${negativePercent}% negative. This indicates the general tone of the discussion.</p><p><strong>Example Strategic Insights</strong></p><ul><li><strong>Leverage Positive Themes:</strong> Identify common topics within the 'Positive' posts. These represent what your audience enjoys and can be amplified in future content and advertising.</li><li><strong>Address Negative Feedback:</strong> The 'Negative' posts are a valuable source of direct feedback. Analyze the justifications to pinpoint specific issues. Addressing these concerns can turn a negative into a brand-building opportunity.</li><li><strong>Monitor and Adapt:</strong> This analysis is a snapshot in time. Repeat it periodically to monitor shifts in public opinion and adapt campaign strategies accordingly.</li></ul>`;
    }
    function renderTechnicalReport(analyzedPostsCount) {
        technicalReportContentPlaceholder.innerHTML = `<h4>Computational Techniques Used:</h4><p>The analysis was performed by making multiple, secure API calls to the Google Gemini model. The full list of posts was broken into smaller batches to ensure reliability and prevent timeouts.</p><h4>Process of Data Analysis (Simplified for Reporting):</h4><ol><li>The ${analyzedPostsCount} social media posts were sent to the Google Gemini API in sequential batches.</li><li>The AI analyzed each post for its emotional tone and provided a justification.</li><li>The results from all batches were combined and aggregated to create the final report.</li></ol>`;
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
