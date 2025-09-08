from __future__ import annotations
from typing import Dict, Any, List, Union, Optional
from dataclasses import dataclass, field
from enum import Enum, auto
import uuid
from datetime import datetime
import json
import base64
import os

# Import security-related modules
from .iqube_security import (
    BlakQubeSecurityManager, 
    RiskAssessment, 
    EncryptionLevel
)

class IQubeType(Enum):
    """Enumeration of iQube Types"""
    DATA = auto()
    CONTENT = auto()
    AGENT = auto()

class OwnerType(Enum):
    """Types of iQube Owners"""
    PERSON = auto()
    ORGANIZATION = auto()
    THING = auto()

class OwnerIdentifiability(Enum):
    """Levels of Owner Identifiability"""
    ANONYMOUS = auto()
    SEMI_ANONYMOUS = auto()
    IDENTIFIABLE = auto()
    SEMI_IDENTIFIABLE = auto()

class EncryptionLevel(Enum):
    """Levels of Encryption"""
    BASIC_AES_256 = auto()
    ADVANCED_RSA_4096 = auto()

class RiskAssessment:
    """Risk Assessment Class"""
    @staticmethod
    def recommend_encryption_level(sensitivity_score: int, risk_score: int) -> str:
        """
        Recommend encryption level based on risk assessment
        
        Args:
            sensitivity_score: Sensitivity score of the data
            risk_score: Risk score of the data
        
        Returns:
            Recommended encryption level
        """
        if sensitivity_score > 5 and risk_score > 5:
            return EncryptionLevel.ADVANCED_RSA_4096
        else:
            return EncryptionLevel.BASIC_AES_256

class BlakQubeSecurityManager:
    """BlakQube Security Manager"""
    @staticmethod
    def encrypt_data(data: Any, key: Optional[bytes] = None, encryption_level: Optional[str] = None) -> Any:
        """
        Encrypt data
        
        Args:
            data: Data to encrypt
            key: Optional encryption key
            encryption_level: Optional encryption level
        
        Returns:
            Encrypted data
        """
        # Implement encryption logic here
        pass
    
    @staticmethod
    def decrypt_data(data: Any, encryption_level: Optional[str] = None) -> Any:
        """
        Decrypt data
        
        Args:
            data: Data to decrypt
            encryption_level: Optional encryption level
        
        Returns:
            Decrypted data
        """
        # Implement decryption logic here
        pass

@dataclass
class MetaQube:
    """
    Metadata layer for all iQubes
    Represents the public, verifiable metadata associated with an iQube
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    identifier: str = "Unnamed iQube"
    creator: str = "Unknown"
    owner_type: OwnerType = OwnerType.PERSON
    content_type: str = "Other"
    owner_identifiability: OwnerIdentifiability = OwnerIdentifiability.SEMI_ANONYMOUS
    transaction_date: datetime = field(default_factory=datetime.now)
    
    # Scoring metrics
    sensitivity_score: float = 0.0
    verifiability_score: float = 0.0
    accuracy_score: float = 0.0
    risk_score: float = 0.0
    
    @property
    def trust_score(self) -> float:
        """
        Compound trust score calculated from individual metrics
        
        Returns:
            A normalized trust score between 0 and 1
        """
        # Weighted calculation of trust score
        # Can be adjusted based on specific requirements
        weights = {
            'sensitivity': 0.2,
            'verifiability': 0.3,
            'accuracy': 0.3,
            'risk': 0.2
        }
        
        # Normalize individual scores to 0-1 range
        normalized_scores = {
            'sensitivity': 1 - (self.sensitivity_score / 10),  # Lower sensitivity increases trust
            'verifiability': self.verifiability_score / 10,
            'accuracy': self.accuracy_score / 10,
            'risk': 1 - (self.risk_score / 10)  # Lower risk increases trust
        }
        
        # Calculate weighted trust score
        trust = sum(
            normalized_scores[metric] * weight 
            for metric, weight in weights.items()
        )
        
        return round(trust, 2)

@dataclass
class BlakQube:
    """
    Private data layer for iQubes
    Represents structured, potentially sensitive data as key-value pairs
    Supports both key-value data and blob storage with encryption
    """
    data: Dict[str, Any] = field(default_factory=dict)
    blob: Optional[bytes] = None
    encrypted_data: Optional[Dict[str, str]] = None
    encryption_level: str = EncryptionLevel.BASIC_AES_256
    
    def add_entry(self, key: str, value: Any) -> None:
        """
        Add or update an entry in the BlakQube
        
        Args:
            key: Unique identifier for the data entry
            value: Data value associated with the key
        """
        self.data[key] = value
    
    def set_blob(self, blob_data: bytes) -> None:
        """
        Set a blob (binary large object) in the BlakQube
        
        Args:
            blob_data: Binary data to store
        """
        self.blob = blob_data
    
    def encrypt(
        self, 
        encryption_key: Optional[bytes] = None, 
        encryption_level: Optional[str] = None
    ) -> None:
        """
        Encrypt the BlakQube data and blob
        
        Args:
            encryption_key: Optional encryption key
            encryption_level: Optional encryption level based on risk
        """
        # Determine encryption level if not provided
        if encryption_level is None and hasattr(self, 'meta'):
            # Assuming meta is a reference to the associated MetaQube
            encryption_level = RiskAssessment.recommend_encryption_level(
                getattr(self.meta, 'sensitivity_score', 5),
                getattr(self.meta, 'risk_score', 5)
            )
        
        # Encrypt data dictionary
        if self.data:
            encrypted_data = BlakQubeSecurityManager.encrypt_data(
                self.data, 
                key=encryption_key, 
                encryption_level=encryption_level
            )
            self.encrypted_data = encrypted_data
            self.data = {}  # Clear original data
        
        # Encrypt blob if present
        if self.blob:
            encrypted_blob = BlakQubeSecurityManager.encrypt_data(
                self.blob, 
                key=encryption_key, 
                encryption_level=encryption_level
            )
            self.encrypted_data['blob'] = encrypted_blob
            self.blob = None
        
        self.encryption_level = encryption_level
    
    def decrypt(self, encryption_key: Optional[bytes] = None) -> None:
        """
        Decrypt the BlakQube data
        
        Args:
            encryption_key: Optional encryption key
        """
        if not self.encrypted_data:
            return
        
        # Decrypt data dictionary
        if 'encrypted_data' in self.encrypted_data:
            self.data = BlakQubeSecurityManager.decrypt_data(
                self.encrypted_data, 
                encryption_level=self.encryption_level
            )
        
        # Decrypt blob if present
        if 'blob' in self.encrypted_data:
            self.blob = BlakQubeSecurityManager.decrypt_data(
                self.encrypted_data['blob'], 
                encryption_level=self.encryption_level
            )
        
        # Clear encrypted data
        self.encrypted_data = None
    
    def get_entry(self, key: str, default: Any = None) -> Any:
        """
        Retrieve an entry from the BlakQube
        
        Args:
            key: Key to retrieve
            default: Default value if key not found
        
        Returns:
            Value associated with the key or default
        """
        return self.data.get(key, default)
    
    def remove_entry(self, key: str) -> None:
        """
        Remove an entry from the BlakQube
        
        Args:
            key: Key to remove
        """
        self.data.pop(key, None)

@dataclass
class DataQube:
    """
    Represents a structured data iQube
    Combines MetaQube and BlakQube for data-centric iQubes
    """
    meta: MetaQube = field(default_factory=MetaQube)
    blak: BlakQube = field(default_factory=BlakQube)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> DataQube:
        """
        Create a DataQube from a dictionary
        
        Args:
            data: Dictionary of data to populate the DataQube
        
        Returns:
            Instantiated DataQube
        """
        meta = MetaQube(
            identifier=data.get('identifier', 'Unnamed DataQube'),
            creator=data.get('creator', 'Unknown')
        )
        blak = BlakQube(data=data.get('data', {}))
        return cls(meta=meta, blak=blak)

@dataclass
class ContentQube:
    """
    Represents a content-based iQube (multi-modal media)
    """
    meta: MetaQube = field(default_factory=MetaQube)
    blak: BlakQube = field(default_factory=BlakQube)
    content: bytes = field(default=b'')
    content_type: str = 'application/octet-stream'
    file_extension: str = ''
    
    def set_content(self, content: bytes, content_type: str, file_extension: str) -> None:
        """
        Set the content for the ContentQube
        
        Args:
            content: Raw bytes of the content
            content_type: MIME type of the content
            file_extension: File extension
        """
        self.content = content
        self.content_type = content_type
        self.file_extension = file_extension

@dataclass
class AgentQube:
    """
    Represents an AI Agent iQube
    Provides comprehensive metadata and performance tracking for AI agents
    """
    meta: MetaQube = field(default_factory=MetaQube)
    blak: BlakQube = field(default_factory=BlakQube)
    
    # Agent Specific Attributes
    name: str = 'Unnamed Agent'
    version: str = '0.1.0'
    type: str = 'Generic AI Agent'
    
    # Capabilities and Technical Details
    capabilities: List[str] = field(default_factory=list)
    languages: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    apis: List[str] = field(default_factory=list)
    
    # Performance Metrics
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    
    def update_performance(self, metric: str, value: Any) -> None:
        """
        Update a performance metric
        
        Args:
            metric: Name of the performance metric
            value: Value of the metric
        """
        self.performance_metrics[metric] = value
    
    def get_performance(self, metric: str, default: Any = None) -> Any:
        """
        Retrieve a performance metric
        
        Args:
            metric: Name of the performance metric
            default: Default value if metric not found
        
        Returns:
            Metric value or default
        """
        return self.performance_metrics.get(metric, default)

# Factory function to create iQubes
def create_iqube(
    iqube_type: IQubeType, 
    meta_data: Dict[str, Any] = {},
    blak_data: Dict[str, Any] = {}
) -> Union[DataQube, ContentQube, AgentQube]:
    """
    Factory method to create different types of iQubes
    
    Args:
        iqube_type: Type of iQube to create
        meta_data: Metadata for the iQube
        blak_data: Private data for the iQube
    
    Returns:
        Instantiated iQube of specified type
    """
    meta = MetaQube(**meta_data)
    blak = BlakQube(data=blak_data)
    
    if iqube_type == IQubeType.DATA:
        return DataQube(meta=meta, blak=blak)
    elif iqube_type == IQubeType.CONTENT:
        return ContentQube(meta=meta, blak=blak)
    elif iqube_type == IQubeType.AGENT:
        return AgentQube(meta=meta, blak=blak)
    else:
        raise ValueError(f"Unsupported iQube type: {iqube_type}")
