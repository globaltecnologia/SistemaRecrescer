import re

with open("/home/alexandre/SistemaRecrescerGlobal/src/catalog.ts", "r") as f:
    content = f.read()

old_enrollments = enrollments: {
