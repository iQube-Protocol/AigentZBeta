import os
from dotenv import load_dotenv
from qube_agent.reasoning.advanced_reasoning import AdvancedReasoningEngine

# Load environment variables from .env file
load_dotenv()

# Simulated iQube Tokens with different characteristics
IQUBE_TOKENS = [
    {
        "token_id": "blockchain_strategy_001",
        "content_type": "strategic_insight",
        "encryption_level": "high",
        "created_at": "2024-01-01T00:00:00Z",
        "tags": ["blockchain", "decentralization", "strategy"],
        "trust_score": 0.85,
        "content": "Emerging blockchain technologies prioritize layer-2 scaling solutions"
    },
    {
        "token_id": "ai_research_002",
        "content_type": "research_paper",
        "encryption_level": "standard",
        "created_at": "2024-01-15T00:00:00Z",
        "tags": ["ai", "machine_learning", "reasoning"],
        "trust_score": 0.92,
        "content": "Advanced reasoning models show promise in multi-agent systems"
    },
    {
        "token_id": "security_insight_003",
        "content_type": "security_analysis",
        "encryption_level": "top_secret",
        "created_at": "2024-02-01T00:00:00Z",
        "tags": ["cybersecurity", "encryption", "threat_analysis"],
        "trust_score": 0.88,
        "content": "Quantum-resistant encryption becoming critical for blockchain security"
    }
]

def main():
    # Ensure OpenAI API key is set
    if 'OPENAI_API_KEY' not in os.environ:
        print("Please set the OPENAI_API_KEY environment variable.")
        exit(1)

    # Initialize Advanced Reasoning Engine
    reasoning_engine = AdvancedReasoningEngine()

    print("\n🔍 1. iQube-Enhanced Objective Decomposition")
    objective = "Develop a secure, scalable decentralized AI agent framework"
    decomposed_plan = reasoning_engine.decompose_objective_with_iqubes(
        objective, 
        IQUBE_TOKENS
    )
    print("Decomposed Objective Plan:")
    print(json.dumps(decomposed_plan, indent=2))

    print("\n🧠 2. iQube Context Synthesis")
    current_context = {
        "project": "QubeAgent",
        "current_phase": "Strategic Planning"
    }
    synthesized_context = reasoning_engine.synthesize_context_with_iqubes(
        current_context, 
        IQUBE_TOKENS
    )
    print("Synthesized Context:")
    print(json.dumps(synthesized_context, indent=2))

    print("\n🤝 3. Multi-Agent iQube Reasoning")
    agent_perspectives = [
        {
            "type": "Blockchain Specialist",
            "keywords": ["blockchain", "decentralization"]
        },
        {
            "type": "AI Researcher",
            "keywords": ["ai", "machine_learning", "reasoning"]
        },
        {
            "type": "Security Expert",
            "keywords": ["cybersecurity", "encryption"]
        }
    ]
    multi_agent_result = reasoning_engine.multi_agent_iqube_reasoning(
        agent_perspectives, 
        IQUBE_TOKENS
    )
    print("Multi-Agent Reasoning Result:")
    print(json.dumps(multi_agent_result, indent=2))

if __name__ == "__main__":
    import json
    main()
