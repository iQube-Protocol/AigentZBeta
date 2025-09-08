from setuptools import setup, find_packages
import os

def read_requirements():
    with open('requirements.txt', 'r') as f:
        return [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name='qubeagent',
    version='0.1.0',
    description='Decentralized AI Agent Framework with iQube Integration',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    author='Your Name',
    author_email='your.email@example.com',
    url='https://github.com/Kn0w-1/QubeAgent',
    packages=find_packages(exclude=['tests*']),
    install_requires=read_requirements(),
    extras_require={
        'dev': [
            'pytest',
            'mypy',
            'black',
            'flake8'
        ]
    },
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
    python_requires='>=3.8',
    entry_points={
        'console_scripts': [
            'qubeagent=qubeagent.cli:main',
        ],
    },
)
