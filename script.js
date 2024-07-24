fetch('/get-plants')
  .then(response => response.json())
  .then(plants => {
    const plantsTable = document.getElementById('plants')

    const header = document.createElement('tr')
    header.innerHTML = `
      <th>Name</th>
      <th>Watering Frequency</th>
      <th>Last Watered</th>
      <th>Next Watering</th>
      <th></th>
      <th></th>
    `
    plantsTable.appendChild(header)

    plants.forEach(plant => {
      const li = document.createElement('tr')
      li.innerHTML = `
        <td>
          <span class="material-symbols-outlined more">more_vert</span>
          <span>${plant.name}</span>
        </td>
        <td>${plant.wateringFrequency}</td>
        <td>${plant.lastWatered}</td>
        <td>${plant.nextWatering}</td>
        <td><button onclick="fetch('/water-plant?id=${plant.id}', { method: 'POST' }).then(() => { location.reload() })">Water</button></td>
        <td><button onclick="fetch('/delete-plant?id=${plant.id}', { method: 'DELETE' }).then(() => { location.reload() })">Delete</button></td>
      `
      plantsTable.appendChild(li)
    })
  })
