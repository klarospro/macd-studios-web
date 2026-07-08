-- Semilla de solicitudes de muestra para el panel admin (datos ficticios de demo).
-- Borra pruebas previas y siembra ejemplos variados por tipo y estado.
delete from public.atlas_applications
where email in ('maria@ejemplo.com', 'diag@test.com', 'diag2@test.com', 'diag3@test.com', 'diag4@test.com');

insert into public.atlas_applications
  (created_at, name, email, phone, address, capital, currency, account_type, agenda, message, status)
values
  (now() - interval '2 hours',  'Elena Márquez',   'elena.marquez@correo.com', '+34 655 210 447', 'Madrid, España',      75000,  'EUR', 'inversor',   'Semana del 14, mañanas', 'Busco preservar capital familiar a largo plazo.',          'pending'),
  (now() - interval '1 day',    'Carlos Ibáñez',   'c.ibanez@correo.com',      '+34 610 883 902', 'Valencia, España',    150000, 'USD', 'accionista', 'Cualquier tarde esta semana', 'Vengo del sector financiero, me interesa participar.', 'pending'),
  (now() - interval '2 days',   'Jorge Ruiz (TechVentures)', 'jorge@techventures.io', '+34 699 004 128', 'Barcelona, España', 40000, 'USD', 'plantilla', 'Videollamada, jueves', 'Quiero licenciar el sistema para mi propio capital.', 'pending'),
  (now() - interval '5 days',   'Ana Sotomayor',   'ana.sotomayor@correo.com', '+34 622 771 560', 'Sevilla, España',     30000,  'EUR', 'inversor',   'Lunes por la mañana',    'Ahorro anual, perfil conservador.',                        'approved'),
  (now() - interval '8 days',   'Miguel Ferrer',   'm.ferrer@correo.com',      '+34 688 315 209', 'Bilbao, España',      12000,  'EUR', 'inversor',   'Sin preferencia',        'Empezar poco a poco.',                                     'rejected');
