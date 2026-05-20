#built using mc-build (https://github.com/mc-build/mc-build)

kill @s
kill @e[type=item,nbt={Item:{id:"minecraft:iron_ingot",Count:3b}},distance=..0.5]
particle firework ~ ~ ~ .5 .5 .5 0 20 force
playsound entity.firework_rocket.blast master @a ~ ~ ~ .5 1.2
summon item ~ ~ ~ {Item:{id:"minecraft:carrot_on_a_stick",Count:1b,tag:{display:{Name:'{"text":"Zipline Hook","color":"#bee9f4","italic":false}'},HideFlags:127,Unbreakable:1b,CustomModelData:80006}}}