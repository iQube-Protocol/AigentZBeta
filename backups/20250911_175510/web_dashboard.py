from flask import Flask, render_template, jsonify
from qube_agent.utils.web_interface import WebInterfaceManager
import logging
import threading
import webbrowser
import time

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Global web interface manager
web_interface = WebInterfaceManager(debug=True)

# Create an initial agent dashboard
AGENT_ID = web_interface.create_agent_dashboard(
    initial_config={
        "name": "QubeAgent Demo",
        "version": "0.2.1"
    }
)

# Flask App
app = Flask(__name__)

@app.route('/')
def index():
    """Render the main dashboard page"""
    return render_template('dashboard.html', agent_id=AGENT_ID)

@app.route('/api/dashboard')
def get_dashboard():
    """API endpoint to get dashboard data"""
    dashboard = web_interface.get_agent_dashboard(AGENT_ID)
    return jsonify({
        'config': dashboard.get('config', {}),
        'status_history': dashboard.get('status_history', []),
        'qube_logs': dashboard.get('qube_logs', [])
    })

def simulate_agent_activity():
    """Simulate ongoing agent activity"""
    while True:
        # Update agent status periodically
        web_interface.update_agent_status(
            AGENT_ID, 
            objective=f"Background Task {time.time()}",
            results={
                "status": "Running",
                "timestamp": time.time()
            }
        )
        
        # Log a sample Qube token processing
        web_interface.log_qube_processing(
            token_id=f"token_{time.time()}",
            data={
                "content": f"Processed at {time.time()}",
                "status": "Processed"
            }
        )
        
        # Wait before next update
        time.sleep(10)

def open_browser():
    """Open web browser after a short delay"""
    time.sleep(2)
    webbrowser.open('http://localhost:5000')

def create_templates_dir():
    """Create templates directory for HTML"""
    import os
    os.makedirs('/Users/hal1/Desktop/CascadeProjects/QubeAgent/templates', exist_ok=True)

def write_dashboard_template():
    """Write HTML template for dashboard"""
    dashboard_html = '''
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>QubeAgent Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .section { background: #f4f4f4; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
            .log-entry { border-bottom: 1px solid #ddd; padding: 10px 0; }
        </style>
    </head>
    <body>
        <h1>QubeAgent Dashboard</h1>
        
        <div class="section">
            <h2>Agent Configuration</h2>
            <div id="config"></div>
        </div>
        
        <div class="section">
            <h2>Status History</h2>
            <div id="status-history"></div>
        </div>
        
        <div class="section">
            <h2>Qube Logs</h2>
            <div id="qube-logs"></div>
        </div>

        <script>
            function updateDashboard() {
                fetch('/api/dashboard')
                    .then(response => response.json())
                    .then(data => {
                        // Update Configuration
                        document.getElementById('config').innerHTML = 
                            Object.entries(data.config)
                                .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                                .join('');

                        // Update Status History
                        document.getElementById('status-history').innerHTML = 
                            data.status_history
                                .map(entry => `
                                    <div class="log-entry">
                                        <p><strong>Objective:</strong> ${entry.objective}</p>
                                        <p><strong>Results:</strong> ${JSON.stringify(entry.results)}</p>
                                        <p><small>${entry.timestamp}</small></p>
                                    </div>
                                `)
                                .join('');

                        // Update Qube Logs
                        document.getElementById('qube-logs').innerHTML = 
                            data.qube_logs
                                .map(log => `
                                    <div class="log-entry">
                                        <p><strong>Token ID:</strong> ${log.token_id}</p>
                                        <p><strong>Data:</strong> ${JSON.stringify(log.data)}</p>
                                        <p><small>${log.timestamp}</small></p>
                                    </div>
                                `)
                                .join('');
                    });
            }

            // Initial update
            updateDashboard();
            
            // Update every 10 seconds
            setInterval(updateDashboard, 10000);
        </script>
    </body>
    </html>
    '''
    
    with open('/Users/hal1/Desktop/CascadeProjects/QubeAgent/templates/dashboard.html', 'w') as f:
        f.write(dashboard_html)

def main():
    # Create templates directory
    create_templates_dir()
    
    # Write dashboard HTML template
    write_dashboard_template()
    
    # Start background agent simulation
    threading.Thread(target=simulate_agent_activity, daemon=True).start()
    
    # Open browser
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run Flask app
    app.run(debug=True, use_reloader=False)

if __name__ == "__main__":
    main()
