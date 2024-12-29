import logging
from qube_agent.utils.web_interface import WebInterfaceManager

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def main():
    # Initialize web interface with debug mode
    web_interface = WebInterfaceManager(debug=True)
    
    # Create an agent dashboard
    agent_id = web_interface.create_agent_dashboard(
        initial_config={
            "name": "QubeAgent Demo",
            "version": "0.2.1"
        }
    )
    
    # Simulate agent status updates
    web_interface.update_agent_status(
        agent_id, 
        objective="Demonstrate Web Interface Functionality",
        results={
            "status": "Running",
            "progress": "50%"
        }
    )
    
    # Log a sample Qube token processing
    web_interface.log_qube_processing(
        token_id="demo_token_123",
        data={
            "content": "Sample encrypted data",
            "decryption_status": "Successful"
        }
    )
    
    # Retrieve and print the agent dashboard
    dashboard = web_interface.get_agent_dashboard(agent_id)
    print("\n--- Agent Dashboard ---")
    print(f"Agent ID: {agent_id}")
    print("Configuration:", dashboard.get('config', {}))
    print("\nStatus History:")
    for status in dashboard.get('status_history', []):
        print(f"- {status}")
    
    print("\nQube Logs:")
    for log in dashboard.get('qube_logs', []):
        print(f"- {log}")

if __name__ == "__main__":
    main()
