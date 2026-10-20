FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
# deps only; source is bind-mounted at /app
RUN python -c "import tomllib;p=tomllib.load(open('pyproject.toml','rb'))['project'];print('\n'.join(p['dependencies']+p['optional-dependencies']['dev']))" > /tmp/req.txt \
 && pip install --no-cache-dir -r /tmp/req.txt
COPY . .
