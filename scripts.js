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
        showLoading();
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
        if (sentimentChartInstance) { sentimentChartInstance.destroy(); sentimentChartInstance = null; }
    }
    function showLoading() { analyzeButton.disabled = true; resetButton.disabled = true; loadingIndicator.style.display = 'block'; }
    function hideLoading() { analyzeButton.disabled = false; resetButton.disabled = false; loadingIndicator.style.display = 'none';}
    function resetTool() {
        textInput.value = ''; fileUpload.value = '';
        outputArea.style.display = 'none'; clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentPosts = []; updatePostCountDisplay(0);
    }
    
    // --- NEW Micro-Task Analysis Function ---
    async function performAnalysis() {
        // FIX: Always get the latest posts from the text area to ensure accuracy
        currentPosts = getPostsFromInput(textInput.value);
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        const BATCH_SIZE = 25;
        const batches = [];
        for (let i = 0; i < postsToAnalyze.length; i += BATCH_SIZE) {
            batches.push(postsToAnalyze.slice(i, i + BATCH_SIZE));
        }

        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live results
        outputArea.style.display = 'block';
        showLoading();
        loadingIndicator.querySelector('p').textContent = 'Initializing analysis...';


        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        
        let allResults = [];

        try {
            // --- Stage 1: Fast Sentiment Categorization ---
            for (let i = 0; i < batches.length; i++) {
                loadingIndicator.querySelector('p').textContent = `Categorizing sentiments in batch ${i + 1} of ${batches.length}...`;
                const response = await fetch('/.netlify/functions/gemini-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task: 'categorize', posts: batches[i] }),
                });
                if (!response.ok) throw new Error(`Server error (${response.status}) during sentiment categorization.`);
                
                const { sentiments } = await response.json();
                if (!sentiments || sentiments.length !== batches[i].length) throw new Error("AI did not return the correct number of sentiments for a batch.");

                // Combine posts with their new sentiments
                const categorizedPosts = batches[i].map((post, index) => ({
                    text: post,
                    sentiment: sentiments[index] || "Unknown",
                }));
                allResults.push(...categorizedPosts);
                renderBatchResults(categorizedPosts); // Render initial cards with sentiment
            }

            // --- Stage 2: Progressive Justification & Final Report ---
            const finalSentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0, Unknown: 0 };
            for (let i = 0; i < allResults.length; i++) {
                loadingIndicator.querySelector('p').textContent = `Generating justification ${i + 1} of ${allResults.length}...`;
                const post = allResults[i];
                
                // Update final counts
                let sentiment = post.sentiment.charAt(0).toUpperCase() + post.sentiment.slice(1).toLowerCase();
                if (finalSentimentCounts.hasOwnProperty(sentiment)) { finalSentimentCounts[sentiment]++; }

                const justResponse = await fetch('/.netlify/functions/gemini-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task: 'justify', post: post.text, sentiment: post.sentiment }),
                });

                if (justResponse.ok) {
                    const { justification } = await justResponse.json();
                    post.justification = justification; // Add justification to our data
                    updateJustificationOnScreen(i, justification); // Update the card on screen
                }
            }
            
            // --- Final Render ---
            loadingIndicator.querySelector('p').textContent = 'Finalizing report...';
            renderVisualization(finalSentimentCounts);
            renderInterpretation(finalSentimentCounts, allResults.length);
            renderTechnicalReport(allResults.length);

        } catch (error) {
            console.error("Analysis Error:", error);
            summaryContentPlaceholder.innerHTML = `<p style="color:red; font-weight: bold; text-align: center; padding: 20px;">Analysis failed: ${error.message}</p>`;
        } finally {
            hideLoading();
        }
    }
    
    // --- Helper Rendering Functions ---
    function renderBatchResults(batchResults) {
        let htmlOutput = '';
        batchResults.forEach(post => {
            let sentiment = post.sentiment || 'N/A';
            sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
            const sentimentClass = sentiment.toLowerCase();
            htmlOutput += `
                <div class="analysis-card card-${sentimentClass}">
                    <blockquote class="post-text">"${post.text}"</blockquote>
                    <p class="post-sentiment"><strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span></p>
                    <div class="justification-placeholder">Justification: <span class="spinner-inline"></span></div>
                </div>
            `;
        });
        summaryContentPlaceholder.innerHTML += htmlOutput;
    }

    function updateJustificationOnScreen(cardIndex, justification) {
        const allPlaceholders = document.querySelectorAll('.justification-placeholder');
        if (allPlaceholders[cardIndex]) {
            allPlaceholders[cardIndex].innerHTML = `<strong>Justification:</strong> ${justification || 'N/A'}`;
        }
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
    function renderInterpretation(sentimentCounts, analyzedPostsCount) {
        if (analyzedPostsCount === 0) { interpretationPlaceholder.innerHTML = "<p>No posts were successfully analyzed.</p>"; return; }
        const positivePercent = ((sentimentCounts.Positive / analyzedPostsCount) * 100).toFixed(1);
        const negativePercent = ((sentimentCounts.Negative / analyzedPostsCount) * 100).toFixed(1);
        interpretationPlaceholder.innerHTML = `<p><strong>What these results mean</strong></p><p>The analysis of ${analyzedPostsCount} posts shows the conversation is ${positivePercent}% positive and ${negativePercent}% negative. This indicates the general tone of the discussion.</p><p><strong>Example Strategic Insights</strong></p><ul><li><strong>Leverage Positive Themes:</strong> Identify common topics within the 'Positive' posts. These represent what your audience enjoys and can be amplified in future content.</li><li><strong>Address Negative Feedback:</strong> The 'Negative' posts are a valuable source of direct feedback. Analyze the justifications to pinpoint specific issues. Addressing these concerns can turn a negative into a brand-building opportunity.</li><li><strong>Monitor and Adapt:</strong> This analysis is a snapshot in time. Repeat it periodically to monitor shifts in public opinion and adapt campaign strategies accordingly.</li></ul>`;
    }
    function renderTechnicalReport(analyzedPostsCount) {
        technicalReportContentPlaceholder.innerHTML = `<h4>Computational Techniques Used:</h4><p>The analysis was performed by making many small, secure API calls to the Google Gemini model. Posts were categorized in batches, and then justifications were generated individually for maximum reliability.</p><h4>Process of Data Analysis (Simplified for Reporting):</h4><ol><li>The ${analyzedPostsCount} social media posts were sent to the Google Gemini API in batches to classify sentiment.</li><li>For each post, a second micro-request was made to the AI to generate a justification for its classification.</li><li>The results from all requests were combined and aggregated to create the final report.</li></ol>`;
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
