# VerdantIQ Multi-Tenant API

A FastAPI backend for a VerdantIQ platform, supporting hybrid user creation and profile updates.

### **Setup and Testing Instructions**

To get the application working locally:

1. **Run the docker compose file for the services to be up**:
   - Start up the docker service using the docker compose file (e.g., via `docker compose up --build `)
   - Login to PostgreSQL container (e.g., via `docker exec -it postgres bash `)
   - Create a database:
     ```bash
     createdb verdantiq_test_db
     ```
2. **Configure Environment Variables**:
   - Save `.env` to the project directory.
   - Update `DATABASE_URL` with your PostgreSQL credentials (e.g., `postgresql://postgres:your_password@localhost:5432/db`).
   - Generate a secure `SECRET_KEY` (e.g., `python -c "import secrets; print(secrets.token_hex(32))"`).

3. **Create Database Tables**:
   - Run `init_db.py`:
     ```bash
     python init_db.py
     ```

4. **Run the Application**:
   - Start the FastAPI server:
     ```bash
     uvicorn main:app --reload
     ```
   - Access Swagger UI at `http://localhost:8000/docs`.

5. **Test Endpoints**:
   - **Register with New Tenant**:
     ```javascript
     fetch('http://localhost:8000/register', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         email: 'farmer@example.com',
         password: 'password123',
         first_name: 'John',
         last_name: 'Doe',
         tenant_name: 'GreenFarm',
         tenant_profile: {
           country: 'Nigeria',
           address: '123 Farm Road, Ogun',
           farm_size: 10.5,
           crop_types: ['maize', 'cassava']
         },
         user_profile: {
           country: 'Nigeria',
           address: '456 Worker Lane, Ogun',
           role: 'manager',
           position: 'senior agronomist'
         }
       })
     }).then(res => res.json()).then(console.log);
     ```
   - **Register with Existing Tenant**:
     ```javascript
     fetch('http://localhost:8000/register', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         email: 'worker@example.com',
         password: 'password123',
         tenant_id: 1,
         user_profile: {
           country: 'Nigeria',
           role: 'field worker'
         }
       })
     }).then(res => res.json()).then(console.log);
     ```
   - **Login**:
     ```javascript
     fetch('http://localhost:8000/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({
         email: 'farmer@example.com',
         password: 'password123'
       })
     }).then(res => res.json()).then(console.log);
     ```
   - **Get Profile**:
     ```javascript
     fetch('http://localhost:8000/users/me', {
       method: 'GET',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include'
     }).then(res => res.json()).then(console.log);
     ```
   - **Update Profile**:
     ```javascript
     fetch('http://localhost:8000/users/me', {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({
         email: 'farmer@example.com',
         first_name: 'Jane',
         user_profile: {
           address: '789 New Lane, Ogun',
           position: 'lead agronomist'
         }
       })
     }).then(res => res.json()).then(console.log);
     ```
   - **Logout**:
     ```javascript
     fetch('http://localhost:8000/logout', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include'
     }).then(res => res.json()).then(console.log);
     ```

6. **Verify Database**:
   - Connect to PostgreSQL (`psql -d verdantiq_test_db`) and check:
     ```sql
     \dt
     SELECT * FROM tenants;
     SELECT * FROM tenant_profiles;
     SELECT * FROM users;
     SELECT * FROM user_profiles;
     SELECT * FROM user_activity_logs;
     ```