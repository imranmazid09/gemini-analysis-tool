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

    // --- Event Listeners and Helper Functions (Unchanged) ---
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
        showLoading(); loadingIndicator.querySelector('p').textContent = 'Reading file...';
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
    function showLoading() { analyzeButton.disabled = true; resetButton.disabled = true; loadingIndicator.style.display = 'block'; }
    function hideLoading() { analyzeButton.disabled = false; resetButton.disabled = false; loadingIndicator.style.display = 'none'; }
    function resetTool() {
        textInput.value = ''; fileUpload.value = '';
        outputArea.style.display = 'none'; clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentPosts = []; updatePostCountDisplay(0);
    }
    
    // --- NEW Resilient Stream Analysis Function ---
    async function performAnalysis() {
        currentPosts = getPostsFromInput(textInput.value);
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        
        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live results
        outputArea.style.display = 'block';
        showLoading();
        
        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        
        let allResults = [];
        let errorCount = 0;

        for (let i = 0; i < postsToAnalyze.length; i++) {
            const postText = postsToAnalyze[i];
            loadingIndicator.querySelector('p').textContent = `Analyzing post ${i + 1} of ${postsToAnalyze.length}...`;
            
            // Render a placeholder card immediately
            const placeholderCard = renderPlaceholderCard(postText, i);
            summaryContentPlaceholder.appendChild(placeholderCard);
            summaryContentPlaceholder.scrollTop = summaryContentPlaceholder.scrollHeight;

            try {
                // Retry logic: try up to 2 times
                let result = null;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const response = await fetch('/.netlify/functions/gemini-proxy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ post: postText }),
                        });
                        if (!response.ok) {
                            throw new Error(`Server error (${response.status})`);
                        }
                        result = await response.json();
                        break; // Success, exit retry loop
                    } catch (e) {
                        if (attempt === 2) throw e; // Final attempt failed, throw the error
                        console.warn(`Attempt ${attempt} failed for post ${i + 1}. Retrying...`);
                    }
                }

                if (!result || !result.sentiment || !result.justification) {
                    throw new Error("AI returned an invalid response.");
                }

                const finalResult = { text: postText, ...result };
                allResults.push(finalResult);
                updateCardWithResult(i, finalResult); // Update the card with real data

            } catch (error) {
                console.error(`Failed to analyze post ${i + 1}:`, error);
                errorCount++;
                updateCardWithError(i, error.message); // Update the card to show an error
            }
        }
        
        // --- Final Report Generation ---
        loadingIndicator.querySelector('p').textContent = 'Finalizing report...';
        const successfulResults = allResults.filter(r => r.sentiment); // Filter out any that might have failed
        
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 };
        successfulResults.forEach(post => {
            let sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + post.sentiment.slice(1).toLowerCase();
            if (sentimentCounts.hasOwnProperty(sentiment)) { sentimentCounts[sentiment]++; }
        });

        renderVisualization(sentimentCounts);
        renderInterpretation(sentimentCounts, successfulResults.length);
        renderTechnicalReport(postsToAnalyze.length, successfulResults.length);
        hideLoading();
    }
    
    // --- NEW Helper Rendering Functions for Live Updates ---
    function renderPlaceholderCard(postText, index) {
        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.id = `card-${index}`;
        card.innerHTML = `
            <blockquote class="post-text">"${postText}"</blockquote>
            <p class="post-sentiment"><strong>Sentiment:</strong> <span class="spinner-inline"></span></p>
            <p class="post-details"><strong>Justification:</strong> <span class="spinner-inline"></span></p>
        `;
        return card;
    }

    function updateCardWithResult(index, result) {
        const card = document.getElementById(`card-${index}`);
        if (!card) return;

        let sentiment = (result.sentiment || 'N/A').charAt(0).toUpperCase() + result.sentiment.slice(1).toLowerCase();
        const sentimentClass = sentiment.toLowerCase();
        
        card.classList.add(`card-${sentimentClass}`);
        card.querySelector('.post-sentiment').innerHTML = `<strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span>`;
        card.querySelector('.post-details').innerHTML = `<strong>Justification:</strong> ${result.justification || 'N/A'}`;
    }

    function updateCardWithError(index, errorMessage) {
        const card = document.getElementById(`card-${index}`);
        if (!card) return;
        card.classList.add('card-error');
        card.querySelector('.post-sentiment').innerHTML = `<strong>Sentiment:</strong> <span class="badge badge-error">Failed</span>`;
        card.querySelector('.post-details').innerHTML = `<strong>Error:</strong> ${errorMessage}`;
    }
    
    // --- Final Report Rendering Functions ---
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
        if (analyzedPostsCount === 0) { interpretationPlaceholder.innerHTML = "<p>No posts were successfully analyzed to generate insights.</p>"; return; }
        const positivePercent = ((sentimentCounts.Positive / analyzedPostsCount) * 100).toFixed(1);
        const negativePercent = ((sentimentCounts.Negative / analyzedPostsCount) * 100).toFixed(1);
        interpretationPlaceholder.innerHTML = `<p><strong>What these results mean</strong></p><p>Out of ${analyzedPostsCount} successfully analyzed posts, the conversation is ${positivePercent}% positive and ${negativePercent}% negative. This indicates the general tone of the discussion.</p><p><strong>Example Strategic Insights</strong></p><ul><li><strong>Leverage Positive Themes:</strong> Identify common topics within the 'Positive' posts. These represent what your audience enjoys and can be amplified in future content.</li><li><strong>Address Negative Feedback:</strong> The 'Negative' posts are a valuable source of direct feedback. Analyze the justifications to pinpoint specific issues. Addressing these concerns can turn a negative into a brand-building opportunity.</li><li><strong>Analyze Failures:</strong> If some posts failed analysis, it might indicate unusual formatting, unsupported languages, or highly ambiguous content. This itself is a finding worth noting.</li></ul>`;
    }
    function renderTechnicalReport(totalPosts, successfulPosts) {
        technicalReportContentPlaceholder.innerHTML = `<h4>Computational Techniques Used:</h4><p>The analysis was performed by making secure, individual API calls for each post to the Google Gemini model. A retry-mechanism was used to handle transient network errors, ensuring maximum reliability.</p><h4>Process of Data Analysis (Simplified for Reporting):</h4><ol><li>The tool processed ${totalPosts} social media posts one by one.</li><li>For each post, it requested a sentiment classification and a justification from the AI.</li><li>${successfulPosts} posts were successfully analyzed. The results for all successful requests were combined and aggregated to create the final report and visualization.</li></ol>`;
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
