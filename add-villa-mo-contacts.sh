#!/bin/bash
# Adds vendor contacts to Villa Mo
# Run this from any machine with internet access

API="https://livaroundbackend-production.up.railway.app"

echo "Logging in..."
TOKEN=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"host@livaround.com","password":"password123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed"
  exit 1
fi
echo "Logged in."

echo "Finding Villa Mo..."
PROPERTY_ID=$(curl -s "$API/api/properties" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.name | test("Mo"; "i")) | .id')

if [ -z "$PROPERTY_ID" ]; then
  echo "Could not find Villa Mo. Available properties:"
  curl -s "$API/api/properties" -H "Authorization: Bearer $TOKEN" | jq '[.[] | {id, name}]'
  exit 1
fi
echo "Villa Mo ID: $PROPERTY_ID"

add_contact() {
  local agency="$1"
  local name="$2"
  local phones="$3"
  local company="$4"
  local notes="$5"

  local body="{\"agency\":\"$agency\""
  [ -n "$name" ]    && body="$body,\"name\":\"$name\""
  [ -n "$phones" ]  && body="$body,\"phones\":$phones"
  [ -n "$company" ] && body="$body,\"company\":\"$company\""
  [ -n "$notes" ]   && body="$body,\"notes\":\"$notes\""
  body="$body}"

  local result=$(curl -s -X POST "$API/api/properties/$PROPERTY_ID/guide/contacts" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")

  echo "  Added: $agency"
}

echo "Adding contacts..."

add_contact "Electrician"                       "Eknath Baragundi"              '["+91 76767 35006"]'                       "TAG Engineers \u0026 Contractors"
add_contact "Plumber"                           "Shantanu"                      '["+91 96048 00926"]'                       "TAG Engineers \u0026 Contractors"
add_contact "HVAC"                              "Manoj Sharma"                  '["+91 98238 66071","+91 74981 45368"]'     "Aermech (Daikin)"
add_contact "Solar Water Heater"                "Suhas Shetkar"                 '["+91 83909 87181"]'                       "Sansri Enterprises"
add_contact "Swimming Pool Filter"              "Swapnil Naik"                  '["+91 98812 28592"]'                       ""
add_contact "Landscape"                         "Mohan Thulasi"                 '["+91 85534 23223"]'                       "Shri Balaji Ganga Bhavani Seedling Supplier"
add_contact "Miscellaneous (Carpenter/Fabricator)" "Manoj Vishwakarma"          '["+91 88983 39395"]'                       "TAG Engineers \u0026 Contractors"
add_contact "WiFi Connection"                   "Parimal Shukla"                '["+91 95299 19829"]'                       "Ethernet Express"
add_contact "Automation"                        "Kedar Tandel"                  '["+91 86551 55332"]'                       "Technet (Mumbai)"
add_contact "UPS, Battery \u0026 Stabiliser"   "Milind Choudhari"              '["+91 92250 74577"]'                       "Powersafe Engineers"
add_contact "Kitchen - Electric Oven, Hob \u0026 Chimney" "Mann Chothani / Adi Dhargalkar" '["+91 95299 97308","+91 97641 05860"]' "Kaff"
add_contact "Kitchen - Built-in Refrigerator \u0026 Dishwasher" "Darshan Kandolkar (or Priti Singh)" '["+91 95526 11626"]' "Carysil"
add_contact "Kitchen - Washing Machine"         "Priti Singh"                   '["+91 88501 76365"]'                       "LG"
add_contact "Kitchen - Refrigerator"            "Priti Singh"                   '["+91 88501 76365"]'                       "Samsung"
add_contact "Kitchen - Water Filter"            "Priti Singh"                   '["+91 88501 76365"]'                       "ZeroB"
add_contact "Kitchen - Microwave Oven"          "Helpline"                      '["+91 92310 04321","+91 90281 29977"]'     "IFB"
add_contact "Kitchen - Gas Cylinder"            "HP Gas near Siolim Church"     '[]'                                        "HP Gas"
add_contact "Society Manager"                   ""                              '[]'                                        "Casa Aurea"
add_contact "Carpenter"                         "Bhom Singh (locks and more)"   '["+91 80007 50529"]'                       "Freelance"
add_contact "Roof Tiles"                        "Shubham Todkar"                '["+91 78877 21111"]'                       "Casa Aurea"
add_contact "MVR Homes Builder CRM"             "Devidas Shetkar"               '["+91 92090 04343"]'                       "Casa Aurea"

echo "Done! All contacts added to Villa Mo."
