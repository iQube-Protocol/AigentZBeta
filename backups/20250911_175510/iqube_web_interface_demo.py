import logging
from agents.qube_agent import QubeAgent

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Sample iQube tokens with strategic insights
IQUBE_TOKENS = [
    {
        "token_id": "blockchain_strategy_001",
        "content_type": "blockchain_research",
        "trust_score": 0.85,
        "tags": ["layer-2", "scalability"],
        "created_at": "2024-01-15T10:30:00Z",
        "data": {
            "research_focus": "Layer-2 blockchain scaling solutions",
            "key_findings": "Emerging technologies prioritize transaction efficiency"
        }
    },
    {
        "token_id": "ai_research_002",
        "content_type": "ai_reasoning",
        "trust_score": 0.92,
        "tags": ["multi-agent", "reasoning"],
        "created_at": "2024-01-20T14:45:00Z",
        "data": {
            "research_area": "Advanced reasoning models in multi-agent systems",
            "key_insights": "Sophisticated reasoning algorithms improve agent coordination"
        }
    },
    {
        "token_id": "security_insight_003",
        "content_type": "cybersecurity",
        "trust_score": 0.88,
        "tags": ["quantum", "encryption"],
        "created_at": "2024-01-25T09:15:00Z",
        "data": {
            "research_topic": "Quantum-resistant encryption methods",
            "key_recommendations": "Develop cryptographic protocols resilient to quantum attacks"
        }
    }
]

def main():
    # Create a QubeAgent with iQube capabilities
    qube_agent = QubeAgent(debug=True)
    
    # Demonstrate iQube token processing
    print("\n🔍 1. Processing iQube Tokens")
    synthesized_context = qube_agent.process_iqube_tokens(IQUBE_TOKENS)
    print("Synthesized Context:", synthesized_context)
    
    # Demonstrate objective decomposition with iQube context
    print("\n🧠 2. Decomposing Objective with iQube Context")
    objective = "Develop a secure, scalable decentralized AI agent framework"
    decomposed_plan = qube_agent.decompose_objective(objective, IQUBE_TOKENS)
    print("Decomposed Objective Plan:", decomposed_plan)
    
    # Retrieve and display the agent's dashboard
    print("\n📊 3. Agent Dashboard with iQube Context Analysis")
    dashboard = qube_agent.get_dashboard()
    
    # Display context analysis
    context_analysis = dashboard.get('context_analysis', {})
    print("Context Analysis:")
    print("Total Context Layers:", context_analysis.get('total_layers', 0))
    print("Trust Score Trends:", context_analysis.get('trust_score_trends', {}))
    print("\nStrategic Evolution:")
    for rec in context_analysis.get('strategic_evolution', []):
        print(f"- {rec.get('recommendation')}: {rec.get('rationale')}")

if __name__ == "__main__":
    main()
