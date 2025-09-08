import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

class WebInterfaceManager:
    def __init__(self, debug: bool = False):
        """
        Initialize web interface management for QubeAgent.
        
        Args:
            debug: Enable verbose logging
        """
        self.debug = debug
        self.logger = logging.getLogger(__name__)
        self.agent_dashboards = {}
        self.iqube_context_registry = {}
    
    def create_agent_dashboard(
        self, 
        agent_id: Optional[str] = None, 
        initial_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a web dashboard for a specific agent with enhanced iQube tracking.
        
        Args:
            agent_id: Unique identifier for the agent
            initial_config: Initial configuration for the dashboard
        
        Returns:
            Dashboard unique identifier
        """
        agent_id = agent_id or str(uuid.uuid4())
        dashboard_config = initial_config or {}
        
        self.agent_dashboards[agent_id] = {
            "config": dashboard_config,
            "status_history": [],
            "qube_logs": [],
            "iqube_context_layers": [],
            "strategic_insights": []
        }
        
        if self.debug:
            self.logger.info(f"Created dashboard for agent: {agent_id}")
        
        return agent_id
    
    def update_agent_status(
        self, 
        agent_id: str, 
        objective: str, 
        results: Dict[str, Any],
        iqube_context: Optional[Dict[str, Any]] = None
    ):
        """
        Update agent's status with iQube-enhanced context tracking.
        
        Args:
            agent_id: Agent's unique identifier
            objective: Current agent objective
            results: Execution results
            iqube_context: Optional iQube context layer
        """
        if agent_id not in self.agent_dashboards:
            self.logger.warning(f"No dashboard found for agent {agent_id}")
            return
        
        status_entry = {
            "objective": objective,
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
        self.agent_dashboards[agent_id]["status_history"].append(status_entry)
        
        # Track iQube context layers
        if iqube_context:
            context_layer_id = str(uuid.uuid4())
            context_layer = {
                "id": context_layer_id,
                "context": iqube_context,
                "timestamp": datetime.now().isoformat()
            }
            self.agent_dashboards[agent_id]["iqube_context_layers"].append(context_layer)
            self.iqube_context_registry[context_layer_id] = context_layer
        
        if self.debug:
            self.logger.info(f"Updated dashboard for agent: {agent_id}")
    
    def log_qube_processing(
        self, 
        token_id: str, 
        data: Dict[str, Any],
        strategic_insights: Optional[List[Dict[str, Any]]] = None
    ):
        """
        Log Qube token processing with strategic insights.
        
        Args:
            token_id: Processed Qube token ID
            data: Decrypted token data
            strategic_insights: Optional strategic insights derived from token
        """
        for agent_id, dashboard in self.agent_dashboards.items():
            qube_log = {
                "token_id": token_id,
                "data": data,
                "timestamp": datetime.now().isoformat()
            }
            dashboard["qube_logs"].append(qube_log)
            
            # Track strategic insights
            if strategic_insights:
                dashboard["strategic_insights"].extend(strategic_insights)
        
        if self.debug:
            self.logger.info(f"Logged Qube token processing: {token_id}")
    
    def get_agent_dashboard(self, agent_id: str) -> Dict[str, Any]:
        """
        Retrieve a specific agent's dashboard with comprehensive iQube tracking.
        
        Args:
            agent_id: Agent's unique identifier
        
        Returns:
            Agent's dashboard with config, logs, context layers, and insights
        """
        dashboard = self.agent_dashboards.get(agent_id, {})
        
        # Enrich dashboard with context analysis
        dashboard['context_analysis'] = self._analyze_context_layers(
            dashboard.get('iqube_context_layers', [])
        )
        
        return dashboard
    
    def _analyze_context_layers(
        self, 
        context_layers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze iQube context layers for patterns and insights.
        
        Args:
            context_layers: List of iQube context layers
        
        Returns:
            Comprehensive context layer analysis
        """
        analysis = {
            "total_layers": len(context_layers),
            "cross_layer_patterns": [],
            "trust_score_trends": [],
            "strategic_evolution": []
        }
        
        if not context_layers:
            return analysis
        
        # Identify cross-layer patterns
        semantic_insights = [
            layer['context'].get('semantic_insights', []) 
            for layer in context_layers
        ]
        
        # Detect recurring themes and trust score trends
        trust_scores = [
            insight['trust_score'] 
            for layer_insights in semantic_insights 
            for insight in layer_insights
        ]
        
        analysis['trust_score_trends'] = {
            'average': sum(trust_scores) / len(trust_scores) if trust_scores else 0,
            'min': min(trust_scores) if trust_scores else 0,
            'max': max(trust_scores) if trust_scores else 0
        }
        
        # Identify strategic evolution
        strategic_recommendations = [
            layer['context'].get('strategic_recommendations', []) 
            for layer in context_layers
        ]
        
        analysis['strategic_evolution'] = [
            rec for sublist in strategic_recommendations for rec in sublist
        ]
        
        return analysis
