from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import json
import io
import requests
import traceback
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import os
import base64
import sys
import ast
app = Flask(__name__)

# Global variable to store DataFrame
global_df = None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global global_df
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.csv'):
        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"))
            global_df = pd.read_csv(stream)
            
            preview_html = global_df.head().to_html(classes='table')
            
            stats = {
                'numeric_columns': global_df.select_dtypes(include=['int64', 'float64']).columns.tolist(),
                'categorical_columns': global_df.select_dtypes(include=['object']).columns.tolist(),
                'missing_values': global_df.isnull().sum().to_dict()
            }
            
            return jsonify({
                'preview': preview_html,
                'statistics': stats,
                'success': True
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
    return jsonify({'error': 'Invalid file type'}), 400

def fix_python_code(code, error_message, df_info):
    """Ask API to fix the Python code based on the error"""
    fix_prompt = f"""You are a Python data analysis expert. Generate Python code to analyze the DataFrame based on this request: "{prompt}"

Available DataFrame Information:
1. The DataFrame 'df' is already loaded. Do not create sample data!
2. Available columns:
   - Numeric: {', '.join(df_info['statistics']['numeric_columns'])}
   - Categorical: {', '.join(df_info['statistics']['categorical_columns'])}
3. First 3 rows: {json.dumps(df_info['first_3_rows'], indent=2)}

Guidelines:
1. Use only existing columns - no assumptions
2. For visualizations:
   - Use matplotlib
3. Handle missing values appropriately
4. Use python syntax that safe to run in flask

Example response format:
```python
# Import required libraries (if needed)
import plotly.express as px

# Perform analysis
result = df[numeric_columns].corr()

# Create visualization
fig = px.imshow(result,
                title='Correlation Matrix')
fig.update_layout(height=600)  # Set figure size"""

    api_response = requests.post(
        'https://api.together.xyz/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.getenv('TOGETHER_API_KEY')}",
            'Content-Type': 'application/json'
        },
        json={
            'model': 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
            'messages': [{'role': 'user', 'content': fix_prompt}]
        }
    )
    
    content = api_response.json()['choices'][0]['message']['content']
    
    # Extract only the Python code
    if '```python' in content:
        fixed_code = content.split('```python')[1].split('```')[0].strip()
    else:
        fixed_code = content.strip()
    
    return fixed_code

def is_table_like(data):
    """
    Deteksi apakah data memiliki struktur tabel.
    - List of dictionaries: [{"col1": "val1", "col2": "val2"}, ...]
    - List of lists: [["col1", "col2"], ["val1", "val2"], ...]
    """
    if isinstance(data, list) and len(data) > 0:
        first_item = data[0]
        if isinstance(first_item, dict):  # List of dictionaries
            return True
        elif isinstance(first_item, list):  # List of lists
            return True
    return False

def render_table(data):
    """
    Render data sebagai tabel HTML.
    """
    if isinstance(data[0], dict):  # List of dictionaries
        headers = data[0].keys()
        rows = [item.values() for item in data]
    else:  # List of lists
        headers = data[0]
        rows = data[1:]

    # Buat tabel HTML
    table_html = "<table border='1'><tr>"
    for header in headers:
        table_html += f"<th>{header}</th>"
    table_html += "</tr>"

    for row in rows:
        table_html += "<tr>"
        for cell in row:
            table_html += f"<td>{cell}</td>"
        table_html += "</tr>"
    table_html += "</table>"

    return table_html

def safe_execute_python(code, df, df_info):
    """Safely execute Python code with the given DataFrame"""
    try:
        namespace = {
            'pd': pd,
            'np': np,
            'plt': plt,
            'sns': sns,
            'df': df
        }

        code = code.replace('plt.show()', '')  # Hapus plt.show()
        output = []
        code_ast = ast.parse(code)

        original_stdout = sys.stdout
        sys.stdout = captured_stdout = io.StringIO()

        for node in code_ast.body:
            # Eksekusi statement
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<string>', 'exec'), namespace)

            # Tangkap output teks
            printed_output = captured_stdout.getvalue()
            if printed_output:
                # Coba parsing output sebagai tabel
                try:
                    parsed_output = ast.literal_eval(printed_output.strip())
                    if is_table_like(parsed_output):
                        table_html = render_table(parsed_output)
                        output.append({'type': 'table', 'content': table_html})
                    else:
                        output.append({'type': 'text', 'content': printed_output.strip()})
                except (ValueError, SyntaxError):
                    # Jika tidak bisa di-parse, anggap sebagai teks biasa
                    output.append({'type': 'text', 'content': printed_output.strip()})
                
                captured_stdout.truncate(0)
                captured_stdout.seek(0)

                # Simpan plot saat ada print() (asumsi plot sudah lengkap)
                if plt.get_fignums():
                    buf = io.BytesIO()
                    plt.savefig(buf, format='png', bbox_inches='tight')
                    plt.close()
                    buf.seek(0)
                    img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
                    output.append({'type': 'plot', 'content': img_base64})

        # Simpan plot terakhir jika ada
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            plt.close()
            buf.seek(0)
            img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            output.append({'type': 'plot', 'content': img_base64})

        sys.stdout = original_stdout
        return output, code, None

    except Exception as e:
        # Handle error seperti sebelumnya
        error_message = str(e)
        print(f"Original error: {error_message}")
        try:
            # Buat tabel ringkasan statistik sebagai fallback
            summary_stats = df.describe()
            plt.figure(figsize=(10, 4))
            plt.axis('off')
            plt.table(cellText=summary_stats.values,
                      colLabels=summary_stats.columns,
                      rowLabels=summary_stats.index,
                      loc='center')
            plt.title("Data Summary Statistics")
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            plt.close()
            buf.seek(0)
            img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return [{'type': 'plot', 'content': img_base64}], code, f"Original code produced error: {error_message}. Showing data summary instead."
        except:
            # Jika semuanya gagal, tampilkan pesan error
            plt.figure(figsize=(6, 2))
            plt.text(0.5, 0.5, f"Error: {error_message}", ha='center', va='center', color='red')
            plt.axis('off')
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            plt.close()
            buf.seek(0)
            img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return [{'type': 'plot', 'content': img_base64}], code, f"Error executing code: {error_message}"

@app.route('/analyze', methods=['POST'])
def analyze():
    global global_df
    
    if global_df is None:
        return jsonify({'error': 'Please upload a CSV file first'}), 400
    
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'No query provided'}), 400
            
        prompt = data['query']
        
        # Definisikan df_info sebelum digunakan
        df_info = {
            'statistics': {
                'numeric_columns': global_df.select_dtypes(include=['int64', 'float64']).columns.tolist(),
                'categorical_columns': global_df.select_dtypes(include=['object']).columns.tolist(),
                'missing_values': global_df.isnull().sum().to_dict()
            },
            'first_3_rows': global_df.head(3).values.tolist(),
            'columns': global_df.columns.tolist()
        }
        
        # Call API to generate code
        api_response = requests.post(
            'https://api.together.xyz/v1/chat/completions',
            headers={
                'Authorization': 'Bearer cfe07b73d607674d54a6843629292568623d695c4741e26944b2437ba918ccce',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
                'messages': [{'role': 'user', 'content': f"""You are a Python data analysis expert. Generate Python code to analyze the DataFrame based on this request/question: "{prompt}"

Available DataFrame Information:
1. The DataFrame 'df' is already loaded. Do not create sample data!
2. Available columns:
   - Numeric: {', '.join(df_info['statistics']['numeric_columns'])}
   - Categorical: {', '.join(df_info['statistics']['categorical_columns'])}
3. First 3 rows: {json.dumps(df_info['first_3_rows'], indent=2)}
4. Use python syntax that safe to run in flask

Guidelines:
1. Use only existing columns - no assumptions
2. Do not create visualization if not needed
3. For visualizations (if needed):
   - Use matplotlib
4. Handle missing values appropriately
5. ALWAYS SHOW THE EXPLANATION OF THE OUTPUT IN print(), IF 2 OR MORE print berurutan, gunakan newline (/n) instead of multiple print()
6. Jangan sampai error, gunakan cara2 yang umum saja."""}]
            }
        )
        
        api_response.raise_for_status()
        api_data = api_response.json()
        
        # Extract code and thinking
        content = api_data['choices'][0]['message']['content']
        code_parts = content.split('```python')
        if len(code_parts) < 2:
            return jsonify({'error': 'No valid Python code found in response'}), 400
            
        thinking = code_parts[0].strip()
        code = code_parts[1].split('```')[0].strip()

        # Execute the code and get the output (text and plots)
        output, final_code, error_message = safe_execute_python(code, global_df, df_info)
        
        # Prepare response
        response = {
            'thinking': thinking,
            'code': final_code,
            'output': output,  # Gabungan teks dan plot
            'error': error_message
        }
        
        return jsonify(response)
            
    except Exception as e:
        trace = traceback.format_exc()
        print(f"Error in analyze: {str(e)}\n{trace}")
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)