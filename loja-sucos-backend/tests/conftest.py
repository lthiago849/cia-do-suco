import os
import sys

# Torna o pacote 'app' importável tanto no container (/tests -> /) quanto localmente
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "..")))
