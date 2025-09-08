from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import RunnablePassthrough
import json
import uuid
from datetime import datetime
import os

class iQubeReasoning:
    """
    Specialized class to integrate iQube concepts into reasoning processes
    """
    @staticmethod
    def extract_iqube_metadata(iqube_token: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and standardize metadata from an iQube token
        
        Args:
            iqube_token: Decrypted iQube token
        
        Returns:
            Standardized metadata dictionary
        """
        return {
            "token_id": iqube_token.get("token_id"),
            "content_type": iqube_token.get("content_type", "unknown"),
            "encryption_level": iqube_token.get("encryption_level", "standard"),
            "origin_timestamp": iqube_token.get("created_at"),
            "semantic_tags": iqube_token.get("tags", []),
            "trust_score": iqube_token.get("trust_score", 0.5)
        }
    
    @staticmethod
    def validate_iqube_context(iqube_token: Dict[str, Any]) -> bool:
        """
        Validate the integrity and trustworthiness of an iQube token
        
        Args:
            iqube_token: Decrypted iQube token
        
        Returns:
            Boolean indicating token validity
        """
        metadata = iQubeReasoning.extract_iqube_metadata(iqube_token)
        
        # Validation criteria
        checks = [
            metadata['trust_score'] > 0.7,  # High trust score
            metadata['content_type'] != "unknown",
            metadata['origin_timestamp'] is not None
        ]
        
        return all(checks)

class AdvancedReasoningEngine:
    """
    Advanced reasoning engine for QubeAgent with iQube integration
    """
    def __init__(
        self, 
        model_name: str = "gpt-4-1106-preview", 
        temperature: float = 0.7,
        api_key: Optional[str] = None
    ):
        """
        Initialize the reasoning engine with optional API key configuration.
        
        Args:
            model_name: OpenAI model to use
            temperature: Sampling temperature for model
            api_key: Optional API key. If not provided, will try environment variable
        """
        # Determine API key source
        if api_key is None:
            api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            print("Warning: No OpenAI API key found. Using mock/test mode.")
            # Implement a mock LLM for testing
            self.llm = self._create_mock_llm()
        else:
            self.llm = ChatOpenAI(
                model_name=model_name, 
                temperature=temperature,
                openai_api_key=api_key
            )
        
        self.context_memory: Dict[str, Dict[str, Any]] = {}
        
        # Enhanced reasoning templates with iQube context
        self.reasoning_templates = {
            "iqube_objective_decomposition": PromptTemplate(
                input_variables=["objective", "iqube_context"],
                template="""
                You are a strategic AI agent analyzing an objective through iQube-enhanced reasoning.
                
                Objective: {objective}
                iQube Context: {iqube_context}
                
                Provide a decomposed plan that:
                1. Integrates iQube semantic insights
                2. Considers trust scores and metadata
                3. Breaks down the objective into actionable steps
                4. Highlights iQube-derived strategic advantages
                
                Response Format: Structured JSON with reasoning steps
                """
            ),
            "iqube_context_synthesis": PromptTemplate(
                input_variables=["current_context", "iqube_tokens"],
                template="""
                Synthesize contextual understanding using iQube tokens.
                
                Current Context: {current_context}
                iQube Tokens: {iqube_tokens}
                
                Tasks:
                1. Extract semantic insights from iQube tokens
                2. Validate token trustworthiness
                3. Integrate high-trust token information
                4. Identify cross-token patterns and insights
                
                Provide a comprehensive, iQube-enhanced context summary in the following strict JSON format:
                {{
                    "semantic_insights": [
                        {{
                            "token_id": "string",
                            "insight": "string",
                            "trust_score": float
                        }}
                    ],
                    "cross_token_patterns": [
                        {{
                            "pattern_name": "string",
                            "description": "string"
                        }}
                    ],
                    "strategic_recommendations": [
                        {{
                            "recommendation": "string",
                            "rationale": "string"
                        }}
                    ]
                }}
                """
            )
        }
    
    def _create_mock_llm(self):
        """
        Create a mock LLM for testing when no API key is available.
        
        Returns:
            A mock LLM that returns predefined responses
        """
        class MockLLM:
            def __init__(self):
                self.mock_responses = {
                    "iqube_objective_decomposition": json.dumps({
                        "plan": {
                            "objective": "Test Objective",
                            "steps": [
                                {
                                    "step_number": 1,
                                    "title": "Mock Step",
                                    "description": "This is a mock step for testing"
                                }
                            ]
                        }
                    }),
                    "iqube_context_synthesis": json.dumps({
                        "semantic_insights": [
                            {
                                "token_id": "mock_token",
                                "insight": "Mock insight for testing",
                                "trust_score": 0.75
                            }
                        ],
                        "cross_token_patterns": [
                            {
                                "pattern_name": "Mock Pattern",
                                "description": "A mock pattern for testing"
                            }
                        ],
                        "strategic_recommendations": [
                            {
                                "recommendation": "Mock Recommendation",
                                "rationale": "Mock rationale for testing"
                            }
                        ]
                    })
                }
            
            def __call__(self, prompt):
                return self
            
            def invoke(self, input_data):
                # Determine which mock response to use based on the input
                if 'iqube_objective_decomposition' in str(input_data):
                    return self.mock_responses['iqube_objective_decomposition']
                elif 'iqube_context_synthesis' in str(input_data):
                    return self.mock_responses['iqube_context_synthesis']
                else:
                    return json.dumps({"mock_response": "Generic mock response"})
            
            def __str__(self):
                return "MockLLM"
        
        return MockLLM()
    
    def decompose_objective_with_iqubes(
        self, 
        objective: str, 
        iqube_tokens: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Decompose an objective using iQube context tokens
        
        Args:
            objective: The main objective to decompose
            iqube_tokens: Optional list of iQube tokens to use for context
        
        Returns:
            Decomposed objective plan with iQube insights
        """
        iqube_tokens = iqube_tokens or []
        
        # Validate and prepare iQube tokens
        valid_iqubes = [
            token for token in iqube_tokens 
            if iQubeReasoning.validate_iqube_context(token)
        ]
        
        # Prepare iQube context for reasoning
        iqube_context = json.dumps([{
            "token_id": token.get('token_id', ''),
            "content_type": token.get('content_type', ''),
            "trust_score": token.get('trust_score', 0.0),
            "key_insights": token.get('data', {}).get('key_findings', '')
        } for token in valid_iqubes])
        
        # Create the chain
        chain = self.reasoning_templates["iqube_objective_decomposition"] | self.llm | JsonOutputParser()
        
        # Check if using mock LLM
        if hasattr(self.llm, 'mock_responses'):
            # Directly return mock response for testing
            mock_response = json.loads(self.llm.mock_responses['iqube_objective_decomposition'])
            
            # Generate plan ID and store
            plan_id = str(uuid.uuid4())
            self.context_memory[plan_id] = {
                "timestamp": datetime.now().isoformat(),
                "objective": objective,
                "decomposed_plan": mock_response,
                "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
            }
            
            return {
                "plan_id": plan_id,
                "decomposed_plan": mock_response,
                "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
            }
        
        # Invoke the chain
        response = chain.invoke({
            "objective": objective,
            "iqube_context": iqube_context
        })
        
        # Generate plan ID and store
        plan_id = str(uuid.uuid4())
        self.context_memory[plan_id] = {
            "timestamp": datetime.now().isoformat(),
            "objective": objective,
            "decomposed_plan": response,
            "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
        }
        
        return {
            "plan_id": plan_id,
            "decomposed_plan": response,
            "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
        }
    
    def synthesize_context_with_iqubes(
        self, 
        current_context: Optional[Dict[str, Any]] = None, 
        iqube_tokens: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Synthesize context using iQube tokens
        
        Args:
            current_context: Existing context
            iqube_tokens: List of iQube tokens to integrate
        
        Returns:
            iQube-enhanced contextual understanding
        """
        current_context = current_context or {}
        iqube_tokens = iqube_tokens or []
        
        # Validate and prepare iQube tokens
        valid_iqubes = [
            token for token in iqube_tokens 
            if iQubeReasoning.validate_iqube_context(token)
        ]
        
        # Create the chain
        chain = self.reasoning_templates["iqube_context_synthesis"] | self.llm | JsonOutputParser()
        
        # Check if using mock LLM
        if hasattr(self.llm, 'mock_responses'):
            # Directly return mock response for testing
            mock_response = json.loads(self.llm.mock_responses['iqube_context_synthesis'])
            
            # Generate context ID and store
            context_id = str(uuid.uuid4())
            self.context_memory[context_id] = {
                "timestamp": datetime.now().isoformat(),
                "context": mock_response,
                "iqube_tokens": [token['token_id'] for token in valid_iqubes]
            }
            
            return {
                "context_id": context_id,
                "synthesized_context": mock_response,
                "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
            }
        
        # Invoke the chain
        response = chain.invoke({
            "current_context": json.dumps(current_context), 
            "iqube_tokens": json.dumps(valid_iqubes)
        })
        
        # Generate context ID and store
        context_id = str(uuid.uuid4())
        self.context_memory[context_id] = {
            "timestamp": datetime.now().isoformat(),
            "context": response,
            "iqube_tokens": [token['token_id'] for token in valid_iqubes]
        }
        
        return {
            "context_id": context_id,
            "synthesized_context": response,
            "used_iqube_tokens": [token['token_id'] for token in valid_iqubes]
        }
    
    def multi_agent_iqube_reasoning(
        self, 
        agent_perspectives: List[Dict[str, Any]],
        shared_iqube_tokens: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Multi-agent reasoning enhanced with shared iQube tokens
        
        Args:
            agent_perspectives: Different agent viewpoints
            shared_iqube_tokens: iQube tokens shared across agents
        
        Returns:
            Synthesized multi-agent reasoning result
        """
        # Annotate agent perspectives with iQube insights
        enhanced_perspectives = []
        for perspective in agent_perspectives:
            relevant_iqubes = [
                token for token in shared_iqube_tokens
                if self._is_iqube_relevant_to_perspective(token, perspective)
            ]
            
            enhanced_perspective = perspective.copy()
            enhanced_perspective['relevant_iqubes'] = [
                iQubeReasoning.extract_iqube_metadata(iqube) 
                for iqube in relevant_iqubes
            ]
            
            enhanced_perspectives.append(enhanced_perspective)
        
        # Synthesize context with enhanced perspectives and iQube tokens
        return self.synthesize_context_with_iqubes(
            current_context={"agents": enhanced_perspectives},
            iqube_tokens=shared_iqube_tokens
        )
    
    def _is_iqube_relevant_to_perspective(
        self, 
        iqube_token: Dict[str, Any], 
        perspective: Dict[str, Any]
    ) -> bool:
        """
        Determine if an iQube token is relevant to an agent's perspective
        
        Args:
            iqube_token: iQube token to evaluate
            perspective: Agent's perspective
        
        Returns:
            Boolean indicating relevance
        """
        # Simple relevance check based on semantic matching
        perspective_keywords = perspective.get('keywords', [])
        iqube_tags = iqube_token.get('tags', [])
        
        return any(
            keyword.lower() in str(tag).lower() 
            for keyword in perspective_keywords 
            for tag in iqube_tags
        )
