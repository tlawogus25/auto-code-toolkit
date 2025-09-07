#!/usr/bin/env python3
"""
Basic test case for main.py
"""

import sys
import os
import unittest
from io import StringIO

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from main import main


class TestMain(unittest.TestCase):
    
    def test_main_output(self):
        """Test that main() prints 'Hello, World!'"""
        captured_output = StringIO()
        sys.stdout = captured_output
        
        main()
        
        sys.stdout = sys.__stdout__
        output = captured_output.getvalue().strip()
        
        self.assertEqual(output, "Hello, World!")


if __name__ == "__main__":
    unittest.main()